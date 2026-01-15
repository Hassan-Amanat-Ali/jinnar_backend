import crypto from 'crypto';
import axios from 'axios';

/**
 * Service to handle Didit Identity Verification interactions
 */
class DiditService {
    constructor() {
        this.sessionUrl = 'https://api.didit.xyz/v1/session'; // Placeholder URL
    }

    /**
     * Verifies the HMAC SHA256 signature of the webhook request
     * @param {Buffer} rawBody - The raw request body
     * @param {string} signature - The 'didit-signature' header
     * @param {string} secret - DIDIT_WEBHOOK_SECRET
     * @param {string|number} timestamp - The 'didit-timestamp' header (optional but recommended)
     * @returns {boolean} - True if valid
     */
    verifySignature(rawBody, signature, secret, timestamp) {
        if (!signature || !secret) return false;

        // 1. Replay Protection (if timestamp is provided)
        if (timestamp) {
            const sentAt = new Date(timestamp * 1000); // Assuming unix timestamp
            const now = new Date();
            const fiveMinutes = 5 * 60 * 1000;

            if (now - sentAt > fiveMinutes) {
                console.error('Didit Webhook: Request expired (Replay Attack protection)');
                return false;
            }
        }

        // 2. Signature Verification
        try {
            const hmac = crypto.createHmac('sha256', secret);
            const digest = hmac.update(rawBody).digest('hex');

            return crypto.timingSafeEqual(
                Buffer.from(digest, 'hex'),
                Buffer.from(signature, 'hex')
            );
        } catch (error) {
            console.error('Didit Webhook: Signature verification error', error);
            return false;
        }
    }

    async createSession(userId) {
        try {
            const url = 'https://verification.didit.me/v3/session/';
            const apiKey = process.env.DIDIT_SECRET_KEY;
            const workflowId = process.env.DIDIT_WORKFLOW_ID;
            const callbackUrl = process.env.DIDIT_CALLBACK_URL;

            if (!apiKey || !workflowId) {
                throw new Error('Missing Didit Configuration (API Key or Workflow ID)');
            }

            const payload = {
                workflow_id: workflowId,
                vendor_data: userId,
                callback: callbackUrl,
                language: 'en', // Defaulting to English, can be made dynamic
                callback_method: 'both' // Ensures callback hits regardless of device
            };

            const response = await axios.post(url, payload, {
                headers: {
                    'x-api-key': apiKey,
                    'Content-Type': 'application/json'
                }
            });

            return {
                sessionId: response.data.session_id,
                url: response.data.url
            };

        } catch (error) {
            console.error('Didit Create Session Error:', error.response?.data || error.message);
            throw new Error('Failed to create verification session');
        }
    }

    /**
     * internal logic to parse the event and return status
     * @param {Object} event 
     * @returns {string} - 'verified', 'rejected', 'pending', etc.
     */
    parseVerificationStatus(event) {
        // This depends on the actual Didit event structure
        // Example: event.type === 'verification.completed' && event.status === 'approved'
        if (event.type === 'verification.completed' || event.status === 'approved') {
            return 'verified';
        } else if (event.status === 'rejected' || event.status === 'failed') {
            return 'rejected';
        }
        return 'pending';
    }
}

export default new DiditService();
