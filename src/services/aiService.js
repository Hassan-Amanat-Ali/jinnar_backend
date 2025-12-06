// File: aiService.js

import { GoogleGenerativeAI } from "@google/generative-ai";
import SupportTicket from "../models/SupportTicket.js"; 
import { configDotenv } from "dotenv";
import User from "../models/User.js";
import { sendPushNotification } from "./pushNotificationService.js";
// Assuming 'response-templates.json' is accessible
import templatesData from './responses-templates.json' with { type: 'json' };


configDotenv();

// --- HELPER TO GET TEMPLATE TITLES (Crucial for AI suggestion) ---
// --- HELPER TO GET ALL TEMPLATE TITLES (No role restriction) ---
const getTemplateTitlesForAnalysis = () => {
  // Flatten all templates from every tier into a single array
  return Object.values(templatesData)
    .flat()                 // Combine arrays from each key
    .map(t => t.name);      // Return only the template names
};



/**
 * Analyzes the incoming support ticket using the Gemini API.
 */




export const analyzeTicket = async (ticketId) => {
  configDotenv();
  const genAI = new GoogleGenerativeAI("AIzaSyCD4ZtNcCY7NJ-wD87FJ0vMfUBSIErNFgk");

  try {
    console.log("===========================================");
    console.log("🧪 Starting AI analysis for ticket:", ticketId);

    // Fetch full ticket
    const ticket = await SupportTicket.findById(ticketId).populate("assignedTo", "role");

    if (!ticket) {
      console.log("❌ Ticket not found:", ticketId);
      return;
    }

    console.log("📦 Loaded Ticket:");
    console.log(JSON.stringify(ticket, null, 2));

    const firstMessage = ticket.conversation.length > 0
      ? ticket.conversation[0].message
      : "";

    const ticketContext = `Subject: ${ticket.subject}\nMessage: ${firstMessage}`;

    const assignedAgentRole = ticket.assignedTo?.role || "support";
    console.log("👤 Assigned Agent Role:", assignedAgentRole);

    const relevantTemplateTitles = getTemplateTitlesForAnalysis(assignedAgentRole);

    console.log("📋 Template Titles Returned:", relevantTemplateTitles);

    if (relevantTemplateTitles.length === 0) {
      console.log("⚠️ WARNING: No template titles found for role:", assignedAgentRole);
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
      generationConfig: { responseMimeType: "application/json" },
    });

    const prompt = `
      You are a specialized Support Assistant for Jinnar. Analyze this support ticket.

      Ticket Content:
      ${ticketContext}

      Available Template Titles for the Agent (${assignedAgentRole}):
      ${relevantTemplateTitles.join('\n')}

      Task:
      1. Categorize into: [billing, technical, dispute, general, spam].
      2. Analyze Sentiment (1-10).
      3. Assign Priority (1-5).
      4. Check for Fraud/Risk (Boolean).
      5. Generate a concise subject (max 10 words).
      6. Suggest the TOP 3 MOST RELEVANT TEMPLATE TITLES from the list.
      7. Write a brief internal note explaining the primary choice.

      Output strict JSON:
      {
        "category": "string",
        "sentiment": number,
        "priority": number,
        "is_fraud": boolean,
        "subject": "string",
        "suggested_templates": ["string", "string", "string"],
        "template_justification": "string"
      }
    `;

    console.log("📝 Final Prompt Sent to Gemini:");
    console.log(prompt);

const result = await model.generateContent({
  contents: [
    {
      role: "user",
      parts: [{ text: prompt }]
    }
  ]
});
    console.log("🤖 Gemini Raw Response Object:");
    console.dir(result, { depth: null });

const responseText = result?.response?.text();
    console.log("🧵 Gemini Response Text:", responseText);

    if (!responseText) {
      console.log("❌ Gemini returned NO response text!");
      return;
    }

    let aiData;
    try {
      aiData = JSON.parse(responseText);
    } catch (parseError) {
      console.error("❌ JSON PARSING FAILED! Response text was:");
      console.error(responseText);
      throw parseError;
    }

    console.log("✅ Parsed AI Data:", aiData);

    // Save analysis
    ticket.subject = aiData.subject;

    ticket.aiAnalysis = {
      isAnalyzed: true,
      category: aiData.category,
      sentimentScore: aiData.sentiment,
      priorityScore: aiData.priority,
      fraudFlag: aiData.is_fraud,
      suggestedTemplates: aiData.suggested_templates,
      templateJustification: aiData.template_justification,
      analyzedAt: new Date(),
    };

    if (aiData.priority >= 4) {
      ticket.priority = "urgent";
    }

    await ticket.save();
    console.log(`✅ Ticket Updated Successfully: ${ticket.ticketId}`);

  } catch (error) {
    console.error("❌ AI Analysis Failed:", error);
  }
};



/**
 * Automatically assigns a ticket to the least-loaded support agent.
 */
export const autoAssignTicket = async (ticketId) => {
  try {
    const agents = await User.aggregate([
      { $match: { role: { $in: ["support", "supervisor", "super_admin"] } } },
      {
        $lookup: {
          from: "supporttickets", 
          let: { agentId: "$_id" },
          pipeline: [
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
      { $addFields: { openTicketCount: { $size: "$activeTickets" } } },
      { $sort: { openTicketCount: 1 } },
      { $limit: 1 },
    ]);

    const bestAgent = agents[0];
    if (!bestAgent) {
      console.log("🤖 Auto-assign: No available agents found.");
      return;
    }

    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket || ticket.assignedTo) {
      console.log("🤖 Auto-assign: Ticket already assigned or not found.");
      return;
    }

    ticket.assignedTo = bestAgent._id;
    ticket.assignmentHistory.push({
      assignedTo: bestAgent._id,
      assignedAt: new Date(),
    });

    await ticket.save();
    console.log(`🤖 Auto-assigned Ticket ${ticket.ticketId} to Agent ${bestAgent.name} (Active Tickets: ${bestAgent.openTicketCount})`);

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