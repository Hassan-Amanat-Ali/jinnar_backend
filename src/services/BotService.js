import { pipeline } from "@xenova/transformers";
import FAQ from "../models/Faq.js";

// Helper: Calculate similarity between two vectors
function cosineSimilarity(vecA, vecB) {
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

class BotService {
  constructor() {
    this.extractor = null;
    this.faqDatabase = []; // Holds questions + embeddings
    this.isReady = false;
  }

  /**
   * Initialize: Load the AI model and index the FAQs.
   * Call this in your index.js instead of .train()
   */
  async load() {
    console.log("🤖 Initializing AI Brain...");

    try {
      // 1. Load the model (downloads automatically on first run, then uses cache)
      // 'Xenova/all-MiniLM-L6-v2' is small, fast, and optimized for English sentence similarity
      this.extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
      console.log("✅ AI Model loaded into memory.");

      // 2. Index the FAQs immediately
      await this.refreshFAQs();
      
      this.isReady = true;
      console.log("✅ Bot Service is fully ready to answer.");
    } catch (error) {
      console.error("❌ Failed to load Bot Service:", error);
    }
  }

  /**
   * Fetches FAQs from DB and converts them into Vector Embeddings
   */
  async refreshFAQs() {
    console.log("🔄 Indexing FAQs for semantic search...");
    const rawFaqs = await FAQ.find({ isActive: true });
    
    // Clear old cache
    this.faqDatabase = [];

    // Process sequentially to keep memory usage stable during startup
    for (const faq of rawFaqs) {
      // Convert the question text into numbers (vector)
      const output = await this.extractor(faq.question, { pooling: 'mean', normalize: true });
      const embedding = Array.from(output.data);

      this.faqDatabase.push({
        id: faq._id,
        question: faq.question,
        answer: faq.answer,
        tags: faq.tags || [],
        embedding: embedding,
      });
    }
    
    console.log(`📂 Indexed ${this.faqDatabase.length} FAQs.`);
  }

  /**
   * Process the user query
   */
  async process(query) {
    // Safety check if requests come in before model is loaded
    if (!this.isReady) {
      return {
        type: "fallback",
        answer: "I'm still waking up. Please try again in a few seconds.",
        suggestions: [],
        confidence: 0
      };
    }

    try {
      // 1. Vectorize the user's query
      const output = await this.extractor(query, { pooling: 'mean', normalize: true });
      const queryEmbedding = Array.from(output.data);

      // 2. Compare against all FAQs
      const results = this.faqDatabase.map(faq => ({
        ...faq,
        score: cosineSimilarity(queryEmbedding, faq.embedding)
      }));

      // 3. Sort by best match
      results.sort((a, b) => b.score - a.score);
      
      const bestMatch = results[0];
      
      // If no FAQs exist or score is extremely low
      if (!bestMatch) {
         return this._getFallbackResponse();
      }

      // --- MATCH LOGIC ---

      // High Confidence ( > 0.65 is usually very accurate for this model)
      if (bestMatch.score > 0.65) {
        return {
          type: "direct_answer",
          answer: bestMatch.answer,
          suggestions: [],
          confidence: bestMatch.score,
        };
      }

      // Medium Confidence: Give suggestions
      if (bestMatch.score > 0.40) {
        const suggestions = results.slice(0, 3).map(r => ({
          question: r.question,
          answer: r.answer, // Included so frontend can preview if needed
          score: r.score
        }));

        return {
          type: "suggestions",
          answer: "I'm not exactly sure, but these look related:",
          suggestions: suggestions,
          confidence: bestMatch.score,
        };
      }

      // Low Confidence: Fallback
      return this._getFallbackResponse();

    } catch (error) {
      console.error("Error processing bot query:", error);
      return this._getFallbackResponse();
    }
  }

  _getFallbackResponse() {
    return {
      type: "fallback",
      answer: "I couldn't find relevant information. Would you like to contact support?",
      suggestions: [],
      confidence: 0,
    };
  }
}

// Export Singleton
export const botService = new BotService();