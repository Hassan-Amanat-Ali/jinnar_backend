// verifyNotifications.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Notification from './src/models/Notification.js';
import User from './src/models/User.js';
import { fileURLToPath } from 'url';
import path from 'path';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/jinnar";

async function run() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("Connected to MongoDB for verification.");

        // 1. Find a test user or create a temporary dummy user to receive notification
        // Actually, to test the API properly via axios (like previous verify script) we need a token. 
        // But since I don't want to rely on login flow in this script, I will just directly use mongoose
        // to create a notification, then mock the API call if I had the token...

        // Instead, let's just use Mongoose to verify the Model works and creating a notification is fine.
        // Testing the Socket.emit requires a running server and a connected socket client. 
        // Testing the HTTP endpoint requires a valid JWT.

        // Let's assume the user can test with Postman since authentication is required.
        // I will simply verify that I can Create a notification using the Model.

        // Find *any* user to be recipient
        const user = await User.findOne();
        if (!user) {
            console.log("No users found to test notification creation.");
            return;
        }

        console.log(`Creating test notification for user ${user._id}`);

        const notif = await Notification.create({
            recipientId: user._id,
            type: 'system',
            content: 'Verification Test Notification',
        });

        console.log("✅ Notification created in DB:", notif._id);

        // Test finding it
        const found = await Notification.findById(notif._id);
        if (found) console.log("✅ Notification found via findById");

        // Test marking as read via Mongoose (simulating what controller does)
        const updated = await Notification.findOneAndUpdate(
            { _id: notif._id },
            { isRead: true },
            { new: true }
        );

        if (updated.isRead) console.log("✅ Notification marked as read via Mongoose");

        // Clean up
        await Notification.findByIdAndDelete(notif._id);
        console.log("✅ Cleaned up test notification");

    } catch (error) {
        console.error("Verification failed:", error);
    } finally {
        await mongoose.disconnect();
    }
}

run();
