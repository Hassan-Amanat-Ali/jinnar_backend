import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../src/models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

async function migrate() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected.');

    const users = await User.find({ role: 'seller' });
    console.log(`Found ${users.length} sellers.`);

    let updatedCount = 0;
    for (const user of users) {
      if (!user.slug) {
        // Trigger hooks
        user.markModified('slug');
        await user.save();
        updatedCount++;
        console.log(`Updated: ${user.name} -> ${user.slug}`);
      }
    }

    console.log(`Migration finished. Updated ${updatedCount} users.`);
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
