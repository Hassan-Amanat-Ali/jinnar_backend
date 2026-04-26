import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

async function test() {
  try {
    console.log("Connecting to:", process.env.MONGO_URI);
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected successfully!");
    await mongoose.disconnect();
  } catch (err) {
    console.error("Connection failed:", err);
  }
}
test();
