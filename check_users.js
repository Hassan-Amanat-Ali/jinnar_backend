import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/jinnar";

async function check() {
    try {
        await mongoose.connect(MONGO_URI);
        const users = await User.find({
            _id: { $in: ['69c7c2925f47e48971f28b92', '69c7c4925f47e48971f307cc'] }
        });

        console.log("Users found:", users.length);
        users.forEach(u => {
            console.log(`User ID: ${u._id}`);
            console.log(`Email: ${u.email}`);
            console.log(`Email Notifications Preference: ${u.preferences?.emailNotifications}`);
            console.log("---");
        });

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

check();
