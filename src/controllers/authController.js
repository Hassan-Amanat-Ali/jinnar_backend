import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import twilio from 'twilio';
import { generateVerificationCode } from '../utils/helpers.js';
import { configDotenv } from 'dotenv';

configDotenv();
// Initialize Twilio client from environment variables (safe for prod)
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhone = process.env.TWILIO_PHONE_NUMBER;
let client = null;
if (accountSid && authToken) {
  try {
    client = twilio(accountSid, authToken);
    console.log('Twilio client initialized for account ending with', accountSid.slice(-6));
  } catch (err) {
    console.error('Twilio initialization failed:', err.message);
    client = null;
  }
} else {
  console.log('Twilio credentials not set; SMS disabled');
}

// Register user with mobile number
export const registerUser = async (req, res) => {
  try {
    const { mobileNumber, role, name = '' } = req.body;

    // Validate inputs
    if (!mobileNumber || !role) {
      return res.status(400).json({ error: 'Mobile number and role are required' });
    }
    if (!['buyer', 'seller'].includes(role)) {
      return res.status(400).json({ error: 'Role must be buyer or seller' });
    }
    if (role === 'seller' && !name) {
      return res.status(400).json({ error: 'Name is required for seller role' });
    }
    if (!/^\+[1-9]\d{1,14}$/.test(mobileNumber)) {
      return res.status(400).json({ error: 'Invalid mobile number format. Use E.164 (e.g., +1234567890)' });
    }

    // Check if user exists
    const existingUser = await User.findOne({ mobileNumber });
    if (existingUser) {
      return res.status(409).json({ error: 'Mobile number already registered' });
    }

    // Create user
    const user = new User({
      mobileNumber,
      role,
      name: name.trim(),
      wallet: { balance: 0, transactions: [] },
      notifications: [],
      orderHistory: [],
      rating: { average: 0, count: 0 },
      preferredAreas: [],
      selectedAreas: role === 'seller' ? [] : undefined,
      availability: role === 'seller' ? [] : undefined,
    });

    const verificationCode = generateVerificationCode();
    user.verificationCode = verificationCode;
    user.verificationCodeExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    await user.save();

    // Send SMS verification (if Twilio configured)
    if (client && twilioPhone || false) {
      try {
        const msg = await client.messages.create({
          body: `Jinnar Services App. Your verification code is: ${verificationCode}`,
          from: '+17064802072',
          to: mobileNumber.toString(),
        });
        console.log(`SMS sent to ${mobileNumber}`, { sid: msg.sid, status: msg.status });
      } catch (smsError) {
        console.error('Twilio SMS Error:', {
          message: smsError.message,
          code: smsError.code,
          status: smsError.status,
          moreInfo: smsError.moreInfo,
        });
      }
    } else {
      console.log('Twilio not configured; skipping SMS send');
    }

    // Also log the code for testing
    console.log(`Verification code for ${mobileNumber}: ${verificationCode}`);

    return res.status(201).json({ message: 'Verification code sent to mobile number' });
  } catch (error) {
    console.error('Register User Error:', error.message);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

// Verify code (registration)
export const verifyCode = async (req, res, next) => {
  try {
    const { mobileNumber, code } = req.body;
    if (!mobileNumber || !code) return res.status(400).json({ error: 'Mobile number and code are required' });

    const user = await User.findOne({ mobileNumber });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.verificationCode !== code || user.verificationCodeExpires < Date.now()) {
      return res.status(400).json({ error: 'Invalid or expired code' });
    }

    user.isVerified = true;
    user.verificationCode = null;
    user.verificationCodeExpires = null;
    await user.save();

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    return res.json({ message: 'Mobile number verified', token });
  } catch (error) {
    console.error('Verify Code Error:', error.message);
    return next(error);
  }
};

// Sign-in (request code)
export const signIn = async (req, res, next) => {
  try {
    const { mobileNumber } = req.body;
    if (!mobileNumber) return res.status(400).json({ error: 'Mobile number is required' });
    if (!/^\+[1-9]\d{1,14}$/.test(mobileNumber)) return res.status(400).json({ error: 'Invalid mobile number format. Use E.164' });

    const user = await User.findOne({ mobileNumber });
    if (!user) return res.status(404).json({ error: 'User not found. Please register first.' });

    const verificationCode = generateVerificationCode();
    user.verificationCode = verificationCode;
    user.verificationCodeExpires = Date.now() + 10 * 60 * 1000;
    user.lastLogin = new Date();
    await user.save();

    console.log(`Sign-in verification code for ${mobileNumber}: ${verificationCode}`);

    // Send SMS verification (if Twilio configured)
    if (client && twilioPhone || false) {
      try {
        const msg = await client.messages.create({
          body: `Jinnar Services App. Your sign-in verification code is: ${verificationCode}`,
          from: '+17064802072',
          to: mobileNumber,
        });
        console.log(`Sign-in SMS sent to ${mobileNumber}`, { sid: msg.sid, status: msg.status });
      } catch (smsError) {
        console.error('Twilio SMS Error:', {
          message: smsError.message,
          code: smsError.code,
          status: smsError.status,
          moreInfo: smsError.moreInfo,
        });
      }
    } else {
      console.log('Twilio not configured; skipping SMS send');
    }

    return res.json({ message: 'Sign-in verification code sent to mobile number' });
  } catch (error) {
    console.error('Sign-In Error:', error.message);
    return next(error);
  }
};

// Verify sign-in code
export const verifySignIn = async (req, res, next) => {
  try {
    const { mobileNumber, code } = req.body;
    if (!mobileNumber || !code) return res.status(400).json({ error: 'Mobile number and code are required' });

    const user = await User.findOne({ mobileNumber });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.verificationCode !== code || user.verificationCodeExpires < Date.now()) return res.status(400).json({ error: 'Invalid or expired code' });

    user.verificationCode = null;
    user.verificationCodeExpires = null;
    user.lastLogin = new Date();
    await user.save();

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    return res.json({ message: 'Sign-in successful', token });
  } catch (error) {
    console.error('Verify Sign-In Error:', error.message);
    return next(error);
  }
};

// Additional auth-related controllers can be added here