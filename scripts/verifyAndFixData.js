import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { faker } from '@faker-js/faker';

dotenv.config();

// Direct Import of Models
import User from '../src/models/User.js';
import Gig from '../src/models/Gig.js';
import Order from '../src/models/Order.js';
import Review from '../src/models/Review.js';

const fixData = async () => {
    try {
        console.log('Connecting via MONGO_URI...');
        if (!process.env.MONGO_URI) throw new Error('MONGO_URI not set');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected.');

        // 1. Fix Users (Sellers)
        console.log('------------- Fix Users (Sellers) -------------');
        const sellers = await User.find({ role: 'seller' });
        console.log(`Found ${sellers.length} sellers.`);

        for (const seller of sellers) {
            let updates = {};

            // A. Ensure Verified
            if (!seller.isVerified || seller.verification.status !== 'verified') {
                updates.isVerified = true;
                updates['verification.status'] = 'verified';
                updates['verification.url'] = faker.internet.url(); // Mock verification URL
            }

            // B. Update Ratings from Reviews
            const reviews = await Review.find({ sellerId: seller._id });
            const reviewCount = reviews.length;
            if (reviewCount > 0) {
                const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
                const avg = parseFloat((sum / reviewCount).toFixed(1));

                // Only update if different
                if (seller.rating?.average !== avg || seller.rating?.count !== reviewCount) {
                    updates['rating.average'] = avg;
                    updates['rating.count'] = reviewCount;
                }
            }

            // Apply Updates
            if (Object.keys(updates).length > 0) {
                await User.updateOne({ _id: seller._id }, { $set: updates });
                console.log(`Updated Seller ${seller.name}: Verified=${updates.isVerified || 'OK'}, Rating=${updates['rating.average'] || 'OK'}`);
            }
        }

        // 2. Fix Gigs
        console.log('------------- Fix Gigs -------------');
        const gigs = await Gig.find({});
        console.log(`Found ${gigs.length} gigs.`);

        for (const gig of gigs) {
            if (gig.status !== 'active') {
                await Gig.updateOne({ _id: gig._id }, { $set: { status: 'active' } });
                console.log(`Activated Gig: ${gig.title}`);
            }
        }

        // 3. Fix Orders (Ensure Completed)
        console.log('------------- Fix Orders -------------');
        const orders = await Order.find({});
        console.log(`Found ${orders.length} orders.`);

        let completedCount = 0;
        for (const order of orders) {
            // If it looks like a seeded order (has review/rating), force complete it
            if ((order.rating || order.review) && order.status !== 'completed') {
                await Order.updateOne({ _id: order._id }, { $set: { status: 'completed' } });
                completedCount++;
            }
        }
        if (completedCount > 0) console.log(`Forced completion on ${completedCount} orders.`);

        console.log('✅ Data Verification & Polish Complete.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
};

fixData();
