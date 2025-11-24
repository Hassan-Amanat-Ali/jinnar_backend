import { botService } from "../services/BotService.js";
import SupportTicket from "../models/SupportTicket.js"; // Assuming FAQ model is not needed here anymore

// Helper for UI Response Structure
const botReply = (message, type = "text", options = [], data = {}) => ({
  success: true,
  response: { type, message, options, ...data }
});

// The main public-facing chat endpoint
export const publicChat = async (req, res) => {
  try {
    // Check req.body first, then query (defensive)
    const { query } = req.body || req.query || {}; 

    // 1. Handle Role/Menu Selection (Click events)
    if (query === "set_role_buyer") {
      return res.json(botReply("As a Buyer, what do you need?", "options", [
        { label: "🔎 Find Gigs", value: "how to find gigs" },
        { label: "💳 Payment Help", value: "payment methods" }
      ]));
    }
    
    if (query === "set_role_seller") {
        return res.json(botReply("As a Seller, what do you need?", "options", [
          { label: "📝 Create Gig", value: "how to create gig" },
          { label: "💰 Withdrawals", value: "how to withdraw" }
        ]));
    }

    if (!query || query === "start") {
        return res.json(botReply(
            "👋 Hi! Welcome to Jinnar Services. I'm your automated assistant.\n\nTo give you the best answers, please tell me:",
            "options",
            [
              { label: "🛒 I want to Hire (Buyer)", value: "set_role_buyer" },
              { label: "💼 I want to Work (Seller)", value: "set_role_seller" },
              { label: "📞 Just contact support", value: "contact_support_start" }
            ]
        ));
    }

    if (query === "contact_support_start") {
      return res.json(botReply(
        "No problem. Since you aren't logged in, please provide your email so we can contact you.",
        "input_email" // Frontend should show Email Input Form
      ));
    }

    // 2. ASK THE LOCAL AI
    const result = await botService.process(query);

    console.log(`Bot Query: "${query}" | Type: ${result.type} | Confidence: ${result.confidence}`);

    // 3. RESPONSE LOGIC
    switch (result.type) {
      case "direct_answer":
        return res.json(botReply(
          result.answer,
          "options",
          [{ label: "Still need help?", value: "contact_support_start" }]
        ));

      case "suggestions":
        // Create options from the suggestions provided by the bot service
        const suggestionOptions = result.suggestions.map(sugg => ({
          label: sugg.question, // Show the suggested question
          value: sugg.question,  // Send the same question back for a direct answer
        }));
        
        return res.json(botReply(
          result.answer, // e.g., "I found a few things that might be related..."
          "options",
          [...suggestionOptions, { label: "❌ None of these, contact support", value: "contact_support_start" }]
        ));

      case "fallback":
      default:
        return res.json(botReply(
          result.answer, // e.g., "I'm not sure... contact support?"
          "options",
          [{ label: "📞 Contact Support", value: "contact_support_start" }, { label: "🔄 Main Menu", value: "start" }]
        ));
    }

  } catch (error) {
    console.error("Chat Error:", error);
    res.status(500).json({ error: "Brain freeze." });
  }
};

export const createGuestTicket = async (req, res) => {
  try {
    const { email, message, name, phone } = req.body;

    if (!email || !message) {
      return res.status(400).json({ error: "Email and Message are required." });
    }

    const ticket = await SupportTicket.create({
      userId: null, // Guest
      guest: {
        name: name || "Guest User",
        email: email,
        phone: phone || null
      },
      subject: "Guest Chatbot Inquiry",
      message,
      status: "open"
    });

    res.status(201).json({
      success: true,
      message: "Ticket created! We will email you at " + email + " shortly."
    });

  } catch (error) {
    res.status(500).json({ error: "Failed to create ticket." });
  }
};

/**
 * @description Debug endpoint to check bot health safely
 */
export const debugBot = async (req, res) => {
  try {
    if (!botService.isTrained) {
        return res.json({ message: "Bot service reports it is NOT trained.", isTrained: false });
    }

    // Safely access internal structure
    const nlp = botService.manager.nlp;
    const nlu = nlp ? nlp.nluManager : null;
    
    // Count docs in English
    let docCount = 0;
    let intents = [];
    
    if (nlu && nlu.domainManagers && nlu.domainManagers.en) {
        const domain = nlu.domainManagers.en;
        docCount = domain.sentences ? domain.sentences.length : 0;
        intents = domain.intents ? Object.keys(domain.intents) : [];
    }

    res.json({
      status: "Online",
      isTrained: botService.isTrained,
      knowledgeSize: docCount,
      intentCount: intents.length,
      sampleIntents: intents.slice(0, 5), // Show first 5 for verification
      message: docCount === 0 ? "WARNING: Bot is empty." : "Bot is healthy."
    });

  } catch (error) {
    console.error("Debug Error:", error);
    // Send text message instead of Error object so it doesn't return {}
    res.status(500).json({ error: error.message, stack: error.stack });
  }
};