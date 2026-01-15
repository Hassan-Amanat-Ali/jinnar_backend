import axios from 'axios';
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const SECRET = process.env.DIDIT_WEBHOOK_SECRET || 'placeholder_webhook_secret';
const URL = 'http://localhost:3000/api/webhooks/didit';

// Mock Payload
const payload = JSON.stringify({
    type: 'verification.completed',
    session_id: 'sess_test_123', // You might need to change this to a real session ID from DB for full test
    status: 'approved',
    details: {}
});

function sign(body, secret) {
    const hmac = crypto.createHmac('sha256', secret);
    return hmac.update(body).digest('hex');
}

async function runTests() {
    console.log('🚀 Starting Didit Webhook Tests...');
    console.log(`Target: ${URL}`);
    console.log(`Secret: ${SECRET}`);

    // Test 1: Valid Signature
    try {
        console.log('\n1️⃣  Testing Valid Signature...');
        const signature = sign(payload, SECRET);
        const res = await axios.post(URL, payload, {
            headers: {
                'Content-Type': 'application/json',
                'didit-signature': signature,
                // Optional: 'didit-timestamp': Math.floor(Date.now() / 1000)
            }
        });
        console.log('✅ Success:', res.status, res.data);
    } catch (err) {
        console.error('❌ Failed:', err.response ? err.response.data : err.message);
    }

    // Test 2: Invalid Signature
    try {
        console.log('\n2️⃣  Testing Invalid Signature...');
        const res = await axios.post(URL, payload, {
            headers: {
                'Content-Type': 'application/json',
                'didit-signature': 'invalid_signature_hex'
            }
        });
        console.log('❌ Unexpected Success (Should have failed):', res.status);
    } catch (err) {
        if (err.response && err.response.status === 401) {
            console.log('✅ Correctly Rejected (401):', err.response.data);
        } else {
            console.error('❌ Failed with unexpected error:', err.message);
        }
    }

    // Test 3: Replay Attack (Old Timestamp)
    try {
        console.log('\n3️⃣  Testing Replay Attack (Old Timestamp)...');
        const signature = sign(payload, SECRET);
        const oldTimestamp = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago

        // Note: If server logic only checks timestamp IF provided, this test assumes we send it.
        // My implementation checks validity IF timestamp is present.
        // If Didit always sends it, we should always check it. 

        const res = await axios.post(URL, payload, {
            headers: {
                'Content-Type': 'application/json',
                'didit-signature': signature,
                'didit-timestamp': oldTimestamp
            }
        });
        console.log('❌ Unexpected Success (Should have failed):', res.status);
    } catch (err) {
        if (err.response && err.response.status === 401) {
            console.log('✅ Correctly Rejected (401 - Replay/Signature):', err.response.data);
        } else {
            console.error('❌ Failed with unexpected error:', err.message);
        }
    }
}

runTests();
