import { NlpManager } from "node-nlp";
import Fuse from "fuse.js"; // For fuzzy search
import FAQ from "../models/FAQ.js";
import fs from "fs";

const MODEL_PATH = "./model.nlp";

class BotService {
  constructor() {
    this.manager = new NlpManager({
      languages: ["en"],
      forceNER: true,
      nlu: { log: false },
    });
    this.isTrained = false;
    this.fuse = null; // Fuse.js instance
    this.faqs = []; // Cache FAQs for fuzzy search

    // Curated synonyms to expand bot knowledge
    this.synonyms = {
      payment: ["deposit", "pay", "charge", "transaction"],
      withdraw: ["payout", "cash out", "withdrawal"],
      gig: ["service", "job", "offer"],
      account: ["profile", "login", "credentials"],
      seller: ["worker", "provider", "freelancer"],
      buyer: ["client", "customer", "hirer"],
    };
  }

  /**
   * Load existing model from disk for a fast start.
   */
  async load() {
    console.log("🤖 Attempting to load bot model from disk...");
    if (fs.existsSync(MODEL_PATH)) {
      // We still need to train Fuse.js and cache FAQs
      await this.train(true); // Pass true to load NLP model
      console.log("📂 Bot Model loaded successfully.");
    } else {
      console.log("⚠️ No bot model found. A full training is required.");
      await this.train(false); // Full training
    }
  }

  /**
   * Generates variations of a question using synonyms.
   * @param {string} question - The original question.
   * @returns {string[]} - An array of question variations.
   */
  _generateVariations(question) {
    const variations = new Set([question]);
    const words = question.toLowerCase().split(/\s+/);

    words.forEach((word) => {
      for (const key in this.synonyms) {
        if (this.synonyms[key].includes(word)) {
          this.synonyms[key].forEach((synonym) => {
            if (synonym !== word) {
              variations.add(question.toLowerCase().replace(word, synonym));
            }
          });
        }
      }
    });

    return Array.from(variations);
  }

  async train(loadFromDisk = false) {
    console.log("🤖 Training Bot Engine...");

    // 1. Fetch and Cache FAQs
    this.faqs = await FAQ.find({ isActive: true });
    if (this.faqs.length === 0) {
      console.log("⚠️ No FAQs found in DB. Bot will be empty.");
      return;
    }

    // 2. Train NLP Model (node-nlp)
    if (loadFromDisk && fs.existsSync(MODEL_PATH)) {
      this.manager.load(MODEL_PATH);
    } else {
      // Reset manager for a clean train
      this.manager = new NlpManager({
        languages: ["en"],
        forceNER: true,
        nlu: { log: false },
      });

      // Add "Small Talk"
      console.log("🧠 Adding small talk...");
      this.manager.addDocument("en", "hello", "greetings.hello");
      this.manager.addDocument("en", "hi", "greetings.hello");
      this.manager.addAnswer(
        "en",
        "greetings.hello",
        "Hi there! I'm the Jinnar Assistant. How can I help?"
      );
      this.manager.addDocument("en", "bye", "greetings.bye");
      this.manager.addAnswer(
        "en",
        "greetings.bye",
        "Goodbye! Have a great day."
      );

      // Feed FAQ data
      console.log(`🧠 Feeding ${this.faqs.length} FAQs to the NLP model...`);
      this.faqs.forEach((faq) => {
        const intentLabel = `faq.${faq._id}`;

        // A. Train with question and its variations
        const variations = this._generateVariations(faq.question);
        variations.forEach((variation) =>
          this.manager.addDocument("en", variation, intentLabel)
        );

        // B. Train with tags
        if (faq.tags && faq.tags.length > 0) {
          faq.tags.forEach((tag) =>
            this.manager.addDocument("en", tag, intentLabel)
          );
        }

        // C. Add the answer
        this.manager.addAnswer("en", intentLabel, faq.answer);
      });

      await this.manager.train();
      this.manager.save(MODEL_PATH);
      console.log(
        `✅ NLP model trained on ${this.faqs.length} FAQs and saved.`
      );
    }

    // 3. Train Fuzzy Search Model (Fuse.js)
    const fuseOptions = {
      keys: ["question", "tags"],
      includeScore: true,
      threshold: 0.4, // Adjust as needed (lower is more strict)
    };
    this.fuse = new Fuse(this.faqs, fuseOptions);
    console.log(
      `✅ Fuzzy search index created with ${this.faqs.length} documents.`
    );

    this.isTrained = true;
    console.log("✅ Bot engine is fully trained and ready.");
  }

  async process(query) {
    if (!this.isTrained) await this.load();

    // 1. Primary Engine: NLP.js
    const nlpResult = await this.manager.process("en", query);
    const { intent, score, answer } = nlpResult;

    // High confidence: Return direct answer
    // Also handle greetings which have a high score but no answer field from process()
    if (answer && score > 0.7) {
      return {
        type: "direct_answer",
        answer: answer,
        suggestions: [],
        confidence: score,
      };
    }

    // Handle greetings specifically if they don't return an answer object
    if (intent && intent.startsWith("greetings.") && score > 0.7) {
      return {
        type: "direct_answer",
        answer:
          nlpResult.answer ||
          (intent === "greetings.hello"
            ? "Hi there! How can I help?"
            : "Goodbye!"),
        confidence: score,
      };
    }

    // 2. Secondary Engine: Fuzzy Search (for low NLP confidence)
    const fuzzyResults = this.fuse.search(query);

    // If NLP has a medium-confidence answer AND it matches the best fuzzy result, it's likely correct.
    if (
      answer &&
      score > 0.5 &&
      fuzzyResults.length > 0 &&
      fuzzyResults[0].item.answer === answer
    ) {
      return {
        type: "direct_answer",
        answer: answer,
        suggestions: [],
        confidence: score,
      };
    }

    // 3. Fallback: Use fuzzy search results to suggest related questions
    if (fuzzyResults.length > 0) {
      const suggestions = fuzzyResults.slice(0, 3).map((result) => ({
        question: result.item.question,
        answer: result.item.answer,
      }));

      return {
        type: "suggestions",
        answer: "I found a few things that might be related. Take a look:",
        suggestions: suggestions,
        confidence: fuzzyResults[0].score, // Using fuzzy score here
      };
    }

    // 4. Final Fallback: No results from either engine
    return {
      type: "fallback",
      answer:
        "I'm not exactly sure how to help with that. Would you like to rephrase your question or contact support?",
      suggestions: [],
      confidence: 0,
    };
  }
}

// Export as a Singleton (One brain for the whole app)
export const botService = new BotService();
