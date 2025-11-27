import { GoogleGenerativeAI } from "@google/generative-ai";
import SupportTicket from "../models/SupportTicket.js"; 
import { configDotenv } from "dotenv";


console.log("Gemini API Key:", process.env.GEMINI_API_KEY);
// Initialize Gemini (Make sure GEMINI_API_KEY is in your .env)
const genAI = new GoogleGenerativeAI( "AIzaSyCD4ZtNcCY7NJ-wD87FJ0vMfUBSIErNFgk");

export const analyzeTicket = async (ticketId) => {
    configDotenv();

  try {
    // 1. Fetch the ticket with necessary details
    const ticket = await SupportTicket.findById(ticketId).populate("user", "name email");
    
    if (!ticket) return;

    // 2. Extract the text to analyze
    // We combine Subject + First Message for context
    const firstMessage = ticket.conversation.length > 0 ? ticket.conversation[0].message : "";
    const ticketContext = `Subject: ${ticket.subject}\nMessage: ${firstMessage}`;

    // 3. Configure the Model
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite", // Fast and cheap
      generationConfig: { responseMimeType: "application/json" }, // FORCE JSON output
    });

    // 4. The Prompt
    const prompt = `
      You are a Support Assistant for Jinnar.com. Analyze this support ticket.

      Ticket Content:
      ${ticketContext}

      Task:
      1. Categorize into: [billing, technical, dispute, general, spam].
      2. Analyze Sentiment (1-10, where 1 is furious, 10 is happy).
      3. Assign Priority (1-5, where 5 is critical/urgent).
      4. Check for Fraud/Risk (Boolean).
      5. Write a professional, empathetic draft response (sign off as "Jinnar Support").

      Output strict JSON:
      {
        "category": "string",
        "sentiment": number,
        "priority": number,
        "is_fraud": boolean,
        "draft_response": "string"
      }
    `;

    // 5. Generate and Parse
    const result = await model.generateContent(prompt);
    const aiData = JSON.parse(result.response.text());

    // 6. Update Database
    ticket.aiAnalysis = {
      isAnalyzed: true,
      category: aiData.category,
      sentimentScore: aiData.sentiment,
      priorityScore: aiData.priority,
      fraudFlag: aiData.is_fraud,
      suggestedResponse: aiData.draft_response,
      analyzedAt: new Date(),
    };

    // Optional: Auto-update the main priority field if it's critical
    if (aiData.priority >= 4) {
      ticket.priority = "urgent";
    }

    await ticket.save();
    console.log(`✅ AI Analyzed Ticket: ${ticket.ticketId}`);

  } catch (error) {
    console.error("❌ AI Analysis Failed:", error.message);
    // We swallow the error so the main server keeps running
  }
};