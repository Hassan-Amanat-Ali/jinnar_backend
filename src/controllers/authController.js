import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import twilio from 'twilio';
import { generateVerificationCode } from '../utils/helpers.js';

// Initialize Twilio client with error handling
const accountSid = 'AC7ead1c418018349aeac184e695582ae7';
const authToken = '19a953288a886a068a42535f5eb5eb32';
const client = twilio(accountSid, authToken);

// Register user with mobile number
export const registerUser = async (req, res, next) => {
  try {
    const { mobileNumber, role, name = "" } = req.body;

    console.log('Registration request:', { mobileNumber, role, name });

   
    // Validate inputs
    if (!mobileNumber || !role ) {
      console.log('Missing required fields:', { mobileNumber, role, name });
      return res.status(400).json({ error: 'Mobile number, role, and name are required' });
    }
    if (!['buyer', 'seller'].includes(role)) {
      console.log('Invalid role:', role);
      return res.status(400).json({ error: 'Role must be buyer or seller' });
    }
    if(role === 'seller' && !name){
      console.log('Missing name for seller role');
      return res.status(400).json({ error: 'Name is required for seller role' });
    }
    
    if (!/^\+[1-9]\d{1,14}$/.test(mobileNumber)) {
      console.log('Invalid mobile number format:', mobileNumber);
      return res.status(400).json({ error: 'Invalid mobile number format. Use E.164 (e.g., +1234567890)' });
    }

    // Check if user exists
    const existingUser = await User.findOne({ mobileNumber });
    if (existingUser) {
      console.log('Mobile number already registered:', mobileNumber);
      return res.status(409).json({ error: 'Mobile number already registered' });
    }

    // Create user with default schema fields
    const user = new User({
      mobileNumber,
      role,
      name: name.trim(),
      wallet: { balance: 0, transactions: [] },
      notifications: [],
      orderHistory: [],
      rating: { average: 0, count: 0 },
      preferredAreas: [],
      selectedAreas: role === 'seller' ? [] : undefined, // Initialize only for sellers
      availability: role === 'seller' ? [] : undefined // Initialize only for sellers
    });

    const verificationCode = generateVerificationCode();
    user.verificationCode = verificationCode;
    user.verificationCodeExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    await user.save();
    console.log('New user registered:', { _id: user._id, mobileNumber, role, name });

    // Send SMS verification
    // if (client && process.env.TWILIO_PHONE_NUMBER) {
    //   try {
    //     await client.messages.create({
    //       body: `Jinnar Services App. Your verification code is: ${verificationCode}`,
    //       from: process.env.TWILIO_PHONE_NUMBER,
    //       to: mobileNumber
    //     });
    //     console.log(`SMS sent to ${mobileNumber}`);
    //   } catch (smsError) {
    //     console.error('Twilio SMS Error:', smsError.message);
    //     // Continue despite SMS failure, as code is logged for testing
    //   }
    // } else {
    //   console.log('Twilio not configured; skipping SMS send');
    // }

    // Log verification code for testing
    console.log(`Verification code for ${mobileNumber}: ${verificationCode}`);

    return res.status(201).json({ message: 'Verification code sent to mobile number' });
  } catch (error) {
    console.error('Register User Error:', error.message, error.stack);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

// Verify code
export const verifyCode = async (req, res, next) => {
  try {
    const { mobileNumber, code } = req.body;

    if (!mobileNumber || !code) {
      return res.status(400).json({ error: 'Mobile number and code are required' });
    }

    const user = await User.findOne({ mobileNumber });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.verificationCode !== code || user.verificationCodeExpires < Date.now()) {
      return res.status(400).json({ error: 'Invalid or expired code' });
    }

    user.isVerified = true;
    user.verificationCode = null;
    user.verificationCodeExpires = null;
    await user.save();

    // Generate JWT
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({ message: 'Mobile number verified', token });
  } catch (error) {
    console.error('Verify Code Error:', error.message);
    next(error);
  }
};

export const signIn = async (req, res, next) => {
  try {
    const { mobileNumber } = req.body;

    if (!mobileNumber) {
      return res.status(400).json({ error: 'Mobile number is required' });
    }

    // Validate mobile number format (E.164)
    if (!/^\+[1-9]\d{1,14}$/.test(mobileNumber)) {
      return res.status(400).json({ error: 'Invalid mobile number format. Use E.164 (e.g., +1234567890)' });
    }

    // Check if user exists
    const user = await User.findOne({ mobileNumber });
    if (!user) {
      return res.status(404).json({ error: 'User not found. Please register first.' });
    }

    // Generate and save verification code
    const verificationCode = generateVerificationCode();
    user.verificationCode = verificationCode;
    user.verificationCodeExpires = Date.now() + 10 * 60 * 1000; // 10 minutes expiry
    user.lastLogin = new Date();
    await user.save();

    console.log(user);
    // Log verification code for testing
    console.log(`Sign-in verification code for ${mobileNumber}: ${verificationCode}`);
try {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    throw new Error('Twilio credentials missing');
  }
  


} catch (error) {
  console.error('Twilio initialization failed:', error.message);
}

    // Send SMS verification
    // if (client && process.env.TWILIO_PHONE_NUMBER) {
    //   try {
         
    //    client.messages
    // .create({
    //     body: `Jinnar Services App. Your sign-in verification code is : ${verificationCode}`,
    //     from: '+17064802072',
    //     to: '+923186548220'
    // })
    // .then(message => console.log(message.sid));
    //     console.log(`Sign-in SMS sent to ${mobileNumber}`);
    //   } catch (smsError) {
    //     console.error('Twilio SMS Error:', smsError.message);
    //   }
    // } else {
    //   console.log(client);
    //   console.log(process.env.TWILIO_PHONE_NUMBER)
    //   console.log('Twilio not configured; skipping SMS send');
    // }

    res.json({ message: 'Sign-in verification code sent to mobile number' });
  } catch (error) {
    console.error('Sign-In Error:', error.message);
    next(error);
  }
};

// Verify sign-in code
export const verifySignIn = async (req, res, next) => {
  try {
    const { mobileNumber, code } = req.body;

    if (!mobileNumber || !code) {
      return res.status(400).json({ error: 'Mobile number and code are required' });
    }

    const user = await User.findOne({ mobileNumber });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.verificationCode !== code || user.verificationCodeExpires < Date.now()) {
      return res.status(400).json({ error: 'Invalid or expired code' });
    }

    // Clear verification code
    user.verificationCode = null;
    user.verificationCodeExpires = null;
        user.lastLogin = new Date();

    await user.save();

    // Generate JWT
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({ message: 'Sign-in successful', token });
  } catch (error) {
    console.error('Verify Sign-In Error:', error.message);
    next(error);
  }
};





// Additional auth-related controllers can be added here