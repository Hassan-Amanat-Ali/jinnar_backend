import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

import Gig from '../src/models/Gig.js';

async function checkStatus() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected!');

        const total = await Gig.countDocuments();
        const withSlug = await Gig.countDocuments({ slug: { $exists: true, $ne: null } });
        const withoutSlug = total - withSlug;

        console.log('\n--- Gig Slug Status ---');
        console.log(`Total Gigs:    ${total}`);
        console.log(`With Slugs:    ${withSlug}`);
        console.log(`Without Slugs: ${withoutSlug}`);

        if (withoutSlug > 0) {
            console.log('\nSample Gigs missing slugs:');
            const sample = await Gig.find({ slug: { $exists: false } }).limit(5).select('title');
            sample.forEach(g => console.log(`- ${g.title}`));
        }

        await mongoose.disconnect();
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

checkStatus();
