import mongoose from "mongoose";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
import { analyzeTicket } from "../src/services/aiService.js";
import SupportTicket from "../src/models/SupportTicket.js";
import User from "../src/models/User.js"; // <-- FIX: Import User model to register it

// Load Environment Variables
dotenv.config();

// THE 10 TEST SCENARIOS
const testTickets = [
  { subject: "Double Charge", message: "I was charged twice for the same job! Please refund me immediately, I am very angry." },
  { subject: "App Crash", message: "Every time I try to upload a photo, the app closes. I am on iPhone 14." },
  { subject: "Account Hacked", message: "I cannot login and I received an email that my password changed. HELP!" },
  { subject: "Job Dispute", message: "The worker did not finish the painting job but marked it as complete. I refuse to pay." },
  { subject: "Spam Offer", message: "Dear Sir, we offer top SEO services for your website. Click here for 50% off." },
  { subject: "Feature Request", message: "I really love the app. Can you add a dark mode option?" },
  { subject: "Harassment Report", message: "The buyer is sending me threatening messages because I was late. I don't feel safe." },
  { subject: "Clarification", message: "How do I change my profile picture? I can't find the setting." },
  { subject: "Payment Method", message: "Do you accept Crypto? I don't have a credit card." },
  { subject: " Gibberish", message: "asdf jkl; test 1234 hello world" }
];

const runTest = async () => {
  try {
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected. Starting Batch Test (10 Tickets)...\n");

    const results = [];

    // Loop through 10 tickets
    for (const [index, data] of testTickets.entries()) {
      console.log(`Processing Ticket ${index + 1}/${testTickets.length}: "${data.subject}"...`);

      // 1. Create Dummy Ticket in DB
      const ticket = await SupportTicket.create({
        ticketId: uuidv4().split("-")[0].toUpperCase(),
        user: new mongoose.Types.ObjectId(), // Fake User ID
        subject: data.subject,
        conversation: [{ sender: new mongoose.Types.ObjectId(), message: data.message, attachments: [] }],
        status: 'open'
      });

      // 2. Run AI Analysis (Using 'await' here just for the test script so we can see output)
      // In production, remember we don't await this!
      await analyzeTicket(ticket._id)

    
      // 3. Fetch the updated ticket to see what AI did
      const updatedTicket = await SupportTicket.findById(ticket._id);
      
      // FIX: Check if analysis was successful before reading properties
      if (updatedTicket.aiAnalysis && updatedTicket.aiAnalysis.isAnalyzed) {
        results.push({
          Subject: updatedTicket.subject,
          Category: updatedTicket.aiAnalysis.category,
          Priority: updatedTicket.aiAnalysis.priorityScore,
          "Fraud?": updatedTicket.aiAnalysis.fraudFlag ? "YES" : "No",
          Sentiment: updatedTicket.aiAnalysis.sentimentScore,
          "Draft Preview": (updatedTicket.aiAnalysis.suggestedResponse || "").substring(0, 50) + "..."
        });
      } else {
        console.log(`   -> ⚠️ AI analysis was skipped or failed for Ticket ${index + 1}.`);
      }
      
      // Small delay to avoid hitting rate limits on the Free tier
      await new Promise(r => setTimeout(r, 1000));
    }

    console.log("\n\n📊 --- AI ANALYSIS RESULTS --- 📊");
    console.table(results);
    console.log("\n✅ Test Complete. Check your Database for full drafts.");

  } catch (error) {
    console.error("❌ Test Failed:", error);
  } finally {
    await mongoose.connection.close();
    process.exit();
  }
};

runTest();