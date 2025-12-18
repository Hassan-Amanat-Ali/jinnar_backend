import User from "../models/User.js";
import jwt from "jsonwebtoken";
import twilio from "twilio";
import { generateVerificationCode } from "../utils/helpers.js";
import { configDotenv } from "dotenv";
import nodemailer from "nodemailer";

configDotenv();

// --- CONFIGURATION ---
console.log(process.env.SMTP_USER);
// 1. Nodemailer Transporter
const transporter = nodemailer.createTransport({
   host: "127.0.0.1",
  // host: "195.110.58.111",

  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false
  }
});

// 2. Twilio Client
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const verifySid = process.env.TWILIO_VERIFY_SERVICE_SID;
let twilioClient = null;

if (accountSid && authToken && verifySid) {
  try {
    twilioClient = twilio(accountSid, authToken);
    console.log("Twilio client initialized for Verify Service");
  } catch (err) {
    console.error("Twilio initialization failed:", err.message);
  }
} else {
  console.log("Twilio credentials missing; SMS verification disabled");
}

// --- HELPER FUNCTIONS ---

/**
 * Determines if the input is an email or a valid mobile number string.
 * Returns: 'email', 'mobileNumber', or 'invalid'
 */
const getIdentifierType = (input) => {
  if (!input) return "invalid";
  
  const emailRegex = /\S+@\S+\.\S+/;
  // Regex allowing +, spaces, dashes, parentheses, and 7-15 digits
  const phoneRegex = /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/im;

  if (emailRegex.test(input)) return "email";
  
  // Clean phone input for check
  const cleanPhone = input.replace(/[\s-()]/g, '');
  if (phoneRegex.test(cleanPhone) || /^\+\d{7,15}$/.test(cleanPhone)) return "mobileNumber";
  
  return "invalid";
};

/**
 * Sends an OTP to a mobile number using Twilio Verify.
 */
const sendTwilioOtp = async (number) => {
  if (!twilioClient) {
    console.log(`[DEV ONLY] Twilio disabled. OTP for ${number} would be sent here.`);
    // In dev, we might want to throw an error or handle it gracefully
    // For now, just logging. A real app might throw.
    return;
  }
  try {
    await twilioClient.verify.v2.services(verifySid)
      .verifications
      .create({ to: number, channel: 'sms' });
    console.log(`Twilio Verify OTP sent to ${number}`);
  } catch (error) {
    console.error(`Twilio Verify failed for ${number}:`, error.message);
    // Re-throw to be caught by the controller
    throw new Error(`Failed to send verification code to ${number}.`);
  }
};

/**
 * Checks an OTP for a mobile number using Twilio Verify.
 * Returns the verification check object.
 */
const checkTwilioOtp = async (number, code) => {
  if (!twilioClient) {
    console.log(`[DEV ONLY] Twilio disabled. Checking OTP for ${number} with code ${code}.`);
    // For local dev without Twilio, we might want a backdoor.
    // For now, we'll assume it fails.
    throw new Error("Twilio service is not available.");
  }
  try {
    const verification_check = await twilioClient.verify.v2.services(verifySid)
      .verificationChecks
      .create({ to: number, code: code });
    console.log(`Twilio Verify check for ${number} status: ${verification_check.status}`);
    return verification_check;
  } catch (error) {
    console.error(`Twilio Verify check failed for ${number}:`, error.message);
    // Twilio sends a 404 if the code is wrong, which throws an error.
    // We can return a mock object or just let it throw.
    // Let's return a status so the controller can handle it.
    return { status: 'failed' };
  }
};

/**
 * Sends an OTP to an email address using Nodemailer.
 * context can be: 'verification' or 'reset'
 */
const sendVerificationEmail = async (user, code, context = "verification") => {
  if (!user.email) {
    console.error("sendVerificationEmail called without a user email.");
    return;
  }

  const subject = context === "reset" ? "Reset Your Jinnar Password" : "Verify Your Jinnar Account";
  const body = `<p>Your Jinnar ${context === "reset" ? "password reset" : "verification"} code is: <b>${code}</b></p><p>This code will expire in 10 minutes.</p>`;

  if (transporter) {
    try {
      const mailOptions = {
        from: `"Jinnar Services" <${process.env.SMTP_USER}>`,
        to: user.email,
        subject: subject,
        html: body,
      };
var   response=   await transporter.sendMail(mailOptions);
      console.log(`Email sent to ${user.email} response ${response}`);
    } catch (emailError) {
      console.error("Error sending email:", emailError);
      throw new Error("Failed to send verification email.");
    }
  }
};

// --- CONTROLLERS ---

export const registerUser = async (req, res) => {
  let savedUser = null; // Track the user for rollback if SMS/Email fails

  try {
    // We expect 'identifier' instead of just 'email'
    const { identifier, role, name = "", password } = req.body;

    // 1. Validate inputs
    if (!identifier || !role || !password) {
      return res.status(400).json({ error: "Email/Phone, role, and password are required" });
    }
    if (!["buyer", "seller"].includes(role)) {
      return res.status(400).json({ error: "Role must be buyer or seller" });
    }
    if (role === "seller" && !name) {
      return res.status(400).json({ error: "Name is required for seller role" });
    }

    // 2. Determine type
    const type = getIdentifierType(identifier);
    if (type === "invalid") {
      return res.status(400).json({ error: "Invalid email or phone number format" });
    }

    // 3. Clean Identifier & Check Duplicates
    const cleanIdentifier = type === "email"
      ? identifier.toLowerCase().trim()
      : identifier.replace(/[\s-()]/g, ''); // Removing spaces/dashes for E.164 compliance
      
    const query = { [type]: cleanIdentifier };

    const existingUser = await User.findOne(query);
    if (existingUser) {
      return res.status(409).json({ error: `${type === "email" ? "Email" : "Phone number"} already registered` });
    }

    // 4. Build User Object
    const userData = {
      role,
      name: name.trim(),
      password,
      wallet: { balance: 0, transactions: [] },
      notifications: [],
      orderHistory: [],
      rating: { average: 0, count: 0 },
      preferredAreas: [],
      [type]: cleanIdentifier,
    };

    if (role === "seller") {
      userData.selectedAreas = [];
      userData.availability = [];
    }

    const user = new User(userData);

    // 5. Save & Send OTP
    if (type === 'email') {
      // --- Email Flow ---
      const verificationCode = generateVerificationCode();
      user.verificationCode = verificationCode;
      user.verificationCodeExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
      
      // Save First
      savedUser = await user.save();
      
      // Attempt Send
      await sendVerificationEmail(user, verificationCode, "verification");

    } else { 
      // --- Mobile Flow (Twilio) ---
      // Twilio handles the code generation, so we don't save a code in DB.
      
      // Save First
      savedUser = await user.save(); 
      
      // Attempt Send
      // If this throws an error (e.g., invalid number), the catch block triggers
      await sendTwilioOtp(cleanIdentifier);
    }

    return res.status(201).json({ 
      message: `Verification code sent to your ${type}`,
      userId: savedUser._id 
    });

  } catch (error) {
    console.error("Register User Error:", error.message);

    // --- ROLLBACK LOGIC ---
    // If we saved the user to DB, but the SMS/Email service failed,
    // we must delete the user so they can correct their info and try again.
    if (savedUser && savedUser._id) {
      console.log(`[Rollback] Deleting user ${savedUser._id} due to messaging failure.`);
      await User.findByIdAndDelete(savedUser._id);
    }
    // ----------------------

    return res.status(500).json({ 
      error: "Registration failed. Please check your phone number/email format.", 
      details: error.message 
    });
  }
};

export const verifyCode = async (req, res, next) => {
  try {
    const { identifier, code } = req.body;
    if (!identifier || !code)
      return res.status(400).json({ error: "Identifier (Email/Phone) and code are required" });

    const type = getIdentifierType(identifier);
    const cleanIdentifier = type === "email"
      ? identifier.toLowerCase().trim()
      : identifier.replace(/[\s-()]/g, '');
    const query = { [type]: cleanIdentifier };

    const user = await User.findOne(query);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (type === 'email') {
      if (
        user.verificationCode !== code ||
        user.verificationCodeExpires < Date.now()
      ) {
        return res.status(400).json({ error: "Invalid or expired code" });
      }
      user.verificationCode = null;
      user.verificationCodeExpires = null;
    } else { // mobileNumber
      const check = await checkTwilioOtp(cleanIdentifier, code);
      if (check.status !== 'approved') {
        return res.status(400).json({ error: "Invalid or expired verification code." });
      }
    }

    user.isVerified = true;
    await user.save();

    return res.json({ message: "Account verified successfully. You can now log in." });
  } catch (error) {
    console.error("Verify Code Error:", error.message);
    return next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ error: "Email/Phone and password are required" });
    }

    // Try finding by Email OR Mobile
    const cleanIdentifier = identifier.trim();
    const user = await User.findOne({
      $or: [
        { email: cleanIdentifier.toLowerCase() },
        { mobileNumber: cleanIdentifier.replace(/[\s-()]/g, '') } // Allow loose phone matching
      ]
    }).select("+password");

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (!user.isVerified) {
      return res.status(403).json({ error: "Account not verified. Please verify first." });
    }
    if (!user.password) {
      return res.status(403).json({ error: "Password not set. Please reset password." });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );
    return res.json({ message: "Login successful", token });
  } catch (error) {
    console.error("Login Error:", error.message);
    return next(error);
  }
};

export const resendVerificationCode = async (req, res, next) => {
  try {
    const { identifier } = req.body;
    if (!identifier) return res.status(400).json({ error: "Email or Phone is required" });

    // 1. Clean the input exactly like we did in Registration
    const type = getIdentifierType(identifier);
    const cleanIdentifier = type === "email"
      ? identifier.toLowerCase().trim()
      : identifier.replace(/[\s-()]/g, ''); // Standardize to E.164
    
    const query = { [type]: cleanIdentifier };

    // 2. Find the "Abandoned" User
    const user = await User.findOne(query);

    // 3. Safety Checks
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.isVerified) return res.status(400).json({ error: "Account already verified. Please log in." });

    // 4. Send New Code
    if (type === 'email') {
      const verificationCode = generateVerificationCode();
      user.verificationCode = verificationCode;
      user.verificationCodeExpires = Date.now() + 10 * 60 * 1000;
      
      // We use validateBeforeSave: false to avoid triggering other validation rules 
      // (like missing name for sellers) just in case.
      await user.save({ validateBeforeSave: false });
      
      await sendVerificationEmail(user, verificationCode, "verification");
    } else { 
      // Mobile Number: Twilio handles the regeneration logic automatically.
      // We just ask it to create a verification again.
      await sendTwilioOtp(cleanIdentifier);
    }

    return res.status(200).json({ message: "New verification code sent." });
  } catch (error) {
    console.error("Resend Code Error:", error.message);
    // If Twilio blocks you for spamming resend, the error will be caught here.
    return res.status(500).json({ error: "Failed to resend code.", details: error.message });
  }
};

export const forgotPassword = async (req, res, next) => {
  try {
    const { identifier } = req.body;
    if (!identifier) return res.status(400).json({ error: "Email or Phone is required" });

    const type = getIdentifierType(identifier);
    const cleanIdentifier = type === "email"
      ? identifier.toLowerCase().trim()
      : identifier.replace(/[\s-()]/g, '');
    const query = { [type]: cleanIdentifier };

    const user = await User.findOne(query);

    if (!user) return res.status(404).json({ error: "User not found." });

    if (type === 'email') {
      const verificationCode = generateVerificationCode();
      user.verificationCode = verificationCode;
      user.verificationCodeExpires = Date.now() + 10 * 60 * 1000;
      await user.save();
      await sendVerificationEmail(user, verificationCode, "reset");
    } else { // mobileNumber
      await sendTwilioOtp(cleanIdentifier);
    }

    res.status(200).json({ message: "Password reset code sent." });
  } catch (error) {
    console.error("Forgot Password Error:", error.message);
    return next(error);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { identifier, code, newPassword } = req.body;

    if (!identifier || !code || !newPassword) {
      return res.status(400).json({ error: "Identifier, code, and new password are required." });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters." });
    }

    const type = getIdentifierType(identifier);
    const cleanIdentifier = type === "email"
      ? identifier.toLowerCase().trim()
      : identifier.replace(/[\s-()]/g, '');
    const query = { [type]: cleanIdentifier };

    const user = await User.findOne(query);

    if (!user) return res.status(404).json({ error: "User not found." });

    if (type === 'email') {
      if (user.verificationCode !== code || user.verificationCodeExpires < Date.now()) {
        return res.status(400).json({ error: "Invalid or expired verification code." });
      }
      user.verificationCode = null;
      user.verificationCodeExpires = null;
    } else { // mobileNumber
      const check = await checkTwilioOtp(cleanIdentifier, code);
      if (check.status !== 'approved') {
        return res.status(400).json({ error: "Invalid or expired verification code." });
      }
    }

    user.password = newPassword;
    await user.save();

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.status(200).json({ message: "Password reset successfully. You are now logged in.", token });

  } catch (error) {
    console.error("Reset Password Error:", error.message);
    return next(error);
  }
};

// --- NEW FEATURE: SECURELY SWITCH CONTACT INFO ---

/**
 * Step 1: User requests to change email/phone.
 * Sends OTP to the NEW contact method to verify ownership before saving to DB.
 */
/**
 * Step 1: User requests to change email/phone.
 * Sends OTP to the NEW contact method to verify ownership before saving to DB.
 */
export const initiateContactChange = async (req, res, next) => {
  try {
    const { newIdentifier, type } = req.body; // type = 'email' or 'mobileNumber'
    const userId = req.user.id; // From auth middleware

    // 1. Basic Validation
    if (!newIdentifier || !["email", "mobileNumber"].includes(type)) {
      return res.status(400).json({ error: "Valid newIdentifier and type (email/mobileNumber) required" });
    }

    // 2. Format the Input (E.164 for phones, lowercase for emails)
    const cleanIdentifier = type === "email"
      ? newIdentifier.toLowerCase().trim()
      : newIdentifier.replace(/[\s-()]/g, ''); // Ensure standard format

    // 3. Check Availability
    const query = { [type]: cleanIdentifier };
    const conflictUser = await User.findOne(query);

    if (conflictUser) {
      // Check if the number belongs to the CURRENT user
      if (conflictUser._id.toString() === userId) {
        return res.status(400).json({ error: `You are already using this ${type === 'email' ? 'email' : 'phone number'}.` });
      }
      // Check if it belongs to SOMEONE ELSE
      return res.status(409).json({ error: "This contact is already in use by another account." });
    }

    // 4. Find the Current User
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    // 5. Generate OTP and Save to Temp Storage
    if (type === 'email') {
      const verificationCode = generateVerificationCode();
      
      user.tempContact = {
        type: 'email',
        value: cleanIdentifier,
        code: verificationCode,
        expires: Date.now() + 10 * 60 * 1000 // 10 minutes
      };
      
      await user.save();
      
      // Send Email OTP
      // We pass a dummy object { email: ... } because our helper expects a user object
      await sendVerificationEmail({ email: cleanIdentifier }, verificationCode, "verification");

    } else { // mobileNumber
      
      user.tempContact = {
        type: 'mobileNumber',
        value: cleanIdentifier,
        expires: Date.now() + 10 * 60 * 1000
        // No code stored in DB because Twilio manages the code for SMS
      };
      
      await user.save();
      
      // Send Twilio OTP
      await sendTwilioOtp(cleanIdentifier);
    }

    res.status(200).json({ message: `Verification code sent to new ${type === 'mobileNumber' ? 'phone number' : 'email'}` });

  } catch (error) {
    console.error("Initiate Change Error:", error.message);
    return next(error);
  }
};

/**
 * Step 2: User verifies the OTP sent to the new contact.
 * Logic: If code matches, we swap the fields in the DB.
 */
export const verifyContactChange = async (req, res, next) => {
  try {
    const { code } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user || !user.tempContact || !user.tempContact.value) {
      return res.status(400).json({ error: "No pending contact change found." });
    }

    if (user.tempContact.expires < Date.now()) {
      return res.status(400).json({ error: "Expired request. Please try again." });
    }

    if (user.tempContact.type === 'email') {
      if (user.tempContact.code !== code) {
        return res.status(400).json({ error: "Invalid verification code" });
      }
      user.email = user.tempContact.value;
    } else { // mobileNumber
      const check = await checkTwilioOtp(user.tempContact.value, code);
      if (check.status !== 'approved') {
        return res.status(400).json({ error: "Invalid verification code." });
      }
      user.mobileNumber = user.tempContact.value;
    }

    // Clear temp data
    user.tempContact = undefined;
    await user.save();

    res.json({ message: "Contact info updated successfully." });
  } catch (error) {
    console.error("Verify Change Error:", error);
    return next(error);
  }
};

export const switchRole = async (req, res, next) => {
  try {
    const { newRole } = req.body;
    const userId = req.user.id;

    if (!newRole || !["buyer", "seller"].includes(newRole)) {
      return res.status(400).json({ error: "Invalid role. Provide 'buyer' or 'seller'." });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found." });

    if (user.role === newRole) {
      return res.status(200).json({ message: `Already in '${newRole}' role.`, role: user.role });
    }

    user.role = newRole;
    await user.save();

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.status(200).json({ success: true, message: `Switched to ${newRole}.`, role: newRole, token });
  } catch (error) {
    console.error("Switch Role Error:", error.message);
    return next(error);
  }
};