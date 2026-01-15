import User from '../models/User.js';
import diditService from '../services/diditService.js';

export const startVerification = async (req, res) => {
    try {
        const userId = req.user._id; // Assuming auth middleware populates req.user
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check existing verification status
        if (user.verification?.status === 'pending' && user.verification?.url) {
            // Return existing session if pending
            return res.status(200).json({
                message: 'Verification already in progress',
                verificationUrl: user.verification.url
            });
        }

        if (user.verification?.status === 'verified') {
            return res.status(200).json({
                message: 'User is already verified',
                status: 'verified'
            });
        }

        // Create new session if none, rejected, expired, or failed
        const { sessionId, url } = await diditService.createSession(userId.toString());

        // Update User
        user.verification = {
            sessionId,
            url,
            status: 'pending',
            lastError: null
        };

        // Also update legacy field if necessary for other parts of the app, 
        // but the new object is the source of truth.
        // user.verificationStatus = 'pending'; 

        await user.save();

        res.status(200).json({
            message: 'Verification session started',
            verificationUrl: url
        });

    } catch (error) {
        console.error('Start Verification Error:', error);
        res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
};
