import { GoogleGenerativeAI } from "@google/generative-ai";
import SupportTicket from "../models/SupportTicket.js"; 
import { configDotenv } from "dotenv";
import User from "../models/User.js";
import { sendPushNotification } from "./pushNotificationService.js";


configDotenv(); // Make sure this is called to load .env variables

// Initialize Gemini (Make sure GEMINI_API_KEY is in your .env)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const analyzeTicket = async (ticketId) => {
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
      model: "gemini-2.5-flash-lite",
       // Use a more recent model
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
      5. Generate a concise, descriptive subject line for the ticket (max 10 words).
      6. Write a professional, empathetic draft response (sign off as "Jinnar Support").
      7. Provide a confidence score (0.0 to 1.0) for how well the draft response resolves the user's issue.

      Output strict JSON:
      {
        "category": "string",
        "sentiment": number,
        "priority": number,
        "is_fraud": boolean,
        "draft_response": "string",
        "subject": "string",
        "confidence_score": number
      }
    `;

    // 5. Generate and Parse
    const result = await model.generateContent(prompt);
    const aiData = JSON.parse(result.response.text());

    // 6. Update Database
    // Always update the ticket subject with the AI-generated one for consistency.
    ticket.subject = aiData.subject;
    ticket.aiAnalysis = {
      isAnalyzed: true,
      category: aiData.category,
      sentimentScore: aiData.sentiment,
      priorityScore: aiData.priority,
      fraudFlag: aiData.is_fraud,
      suggestedResponse: aiData.draft_response,
      confidenceScore: aiData.confidence_score,
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

/**
 * Automatically assigns a ticket to the least-loaded support agent.
 * This function avoids the "Zero Ticket Bug" by querying users first.
 * @param {string} ticketId The ID of the ticket to assign.
 */
export const autoAssignTicket = async (ticketId) => {
  try {
    // 1. Find the least-loaded agent using an aggregation pipeline
    const agents = await User.aggregate([
      // Step 1: Find all potential agents
      {
        $match: {
          role: { $in: ["support", "supervisor", "super_admin"] },
        },
      },
      // Step 2: Look up their assigned tickets
      {
        $lookup: {
          from: "supporttickets", // The collection name for SupportTicket model
          let: { agentId: "$_id" },
          pipeline: [
            // Step 3: Filter for open/in_progress tickets only
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$assignedTo", "$$agentId"] },
                    { $in: ["$status", ["open", "in_progress"]] },
                  ],
                },
              },
            },
          ],
          as: "activeTickets",
        },
      },
      // Step 4: Create a field with the count of active tickets
      {
        $addFields: {
          openTicketCount: { $size: "$activeTickets" },
        },
      },
      // Step 5: Sort by the count (ascending) to find the least busy
      {
        $sort: {
          openTicketCount: 1,
        },
      },
      // Step 6: Get the top result
      {
        $limit: 1,
      },
    ]);

    const bestAgent = agents[0];
    if (!bestAgent) {
      console.log("🤖 Auto-assign: No available agents found.");
      return;
    }

    // 7. Assign the ticket to the found agent
    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket || ticket.assignedTo) {
      console.log("🤖 Auto-assign: Ticket already assigned or not found.");
      return; // Don't re-assign if it's already been handled
    }

    ticket.assignedTo = bestAgent._id;
    ticket.assignmentHistory.push({
      assignedTo: bestAgent._id,
      assignedAt: new Date(),
      // assignedBy is omitted for system assignments
    });

    await ticket.save();
    console.log(`🤖 Auto-assigned Ticket ${ticket.ticketId} to Agent ${bestAgent.name} (Active Tickets: ${bestAgent.openTicketCount})`);

    // 8. Notify the assigned agent
    if (bestAgent.fcmTokens?.length > 0) {
      const notification = {
        title: "New Ticket Assigned",
        body: `You have been automatically assigned ticket #${ticket.ticketId}.`,
        data: { ticketId: ticket._id.toString() },
      };
      bestAgent.fcmTokens.forEach(tokenInfo => sendPushNotification(tokenInfo.token, notification));
    }
  } catch (error) {
    console.error("❌ Auto-assignment failed:", error.message);
  }
};