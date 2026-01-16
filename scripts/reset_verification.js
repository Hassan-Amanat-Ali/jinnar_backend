
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../src/models/User.js'; // Adjust path if needed

dotenv.config();

const resetVerification = async () => {
    const email = process.argv[2];

    if (!email) {
        console.error('Please provide an email address: node scripts/reset_verification.js <email>');
        process.exit(1);
    }

    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const user = await User.findOne({ email });

        if (!user) {
            console.error('User not found');
            process.exit(1);
        }

        console.log(`Found user: ${user.email}`);
        console.log('Current status:', user.verification);

        user.verification = {
            status: 'none',
            sessionId: null,
            url: null,
            lastError: null
        };

        await user.save();
        console.log('Verification status reset to "none". You can now start a new verification session.');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
};

resetVerification();
