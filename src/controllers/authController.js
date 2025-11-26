import User from "../models/User.js";
import jwt from "jsonwebtoken";
import twilio from "twilio";
import { generateVerificationCode } from "../utils/helpers.js";
import { configDotenv } from "dotenv";

configDotenv();
// Initialize Twilio client from environment variables (safe for prod)
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhone = process.env.TWILIO_PHONE_NUMBER;
let client = null;
if (accountSid && authToken) {
  try {
    client = twilio(accountSid, authToken);
    console.log(
      "Twilio client initialized for account ending with",
      accountSid.slice(-6),
    );
  } catch (err) {
    console.error("Twilio initialization failed:", err.message);
    client = null;
  }
} else {
  console.log("Twilio credentials not set; SMS disabled");
}

// Register user with mobile number
export const registerUser = async (req, res) => {
  try {
    const { mobileNumber, role, name = "", password } = req.body;

    // Validate inputs

    if (!mobileNumber || !role || !password) {
      return res
        .status(400)
        .json({ error: "Mobile number, role, and password are required" });
    }
    if (!["buyer", "seller"].includes(role)) {
      return res.status(400).json({ error: "Role must be buyer or seller" });
    }
    if (role === "seller" && !name) {
      return res
        .status(400)
        .json({ error: "Name is required for seller role" });
    }
    if (!/^\+[1-9]\d{1,14}$/.test(mobileNumber)) {
      return res
        .status(400)
        .json({
          error: "Invalid mobile number format. Use E.164 (e.g., +1234567890)",
        });
    }

    // Check if user exists
    const existingUser = await User.findOne({ mobileNumber });
    if (existingUser) {
      return res
        .status(409)
        .json({ error: "Mobile number already registered" });
    }

    // Create user
    const user = new User({
      mobileNumber,
      role,
      name: name.trim(),
      password,
      wallet: { balance: 0, transactions: [] },
      notifications: [],
      orderHistory: [],
      rating: { average: 0, count: 0 },
      preferredAreas: [],
      selectedAreas: role === "seller" ? [] : undefined,
      availability: role === "seller" ? [] : undefined,
    });

    const verificationCode = generateVerificationCode();
    user.verificationCode = verificationCode;
    user.verificationCodeExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    await user.save();

    // Send SMS verification (if Twilio configured)
    if (client && twilioPhone && process.env.ENABLE_TWILIO_SMS === 'true') {
      try {
        const msg = await client.messages.create({
          body: `Jinnar Services App. Your verification code is: ${verificationCode}`,
          from: "+17064802072",
          to: mobileNumber.toString(),
        });
        console.log(`SMS sent to ${mobileNumber}`, {
          sid: msg.sid,
          status: msg.status,
        });
      } catch (smsError) {
        console.error("Twilio SMS Error:", {
          message: smsError.message,
          code: smsError.code,
          status: smsError.status,
          moreInfo: smsError.moreInfo,
        });
      }
    } else {
      console.log("Twilio not configured; skipping SMS send");
    }

    // Also log the code for testing
    console.log(`Verification code for ${mobileNumber}: ${verificationCode}`);

    return res
      .status(201)
      .json({ message: "Verification code sent to mobile number"  , verificationCode});
  } catch (error) {
    console.error("Register User Error:", error.message);
    return res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
};

// Verify code (registration)
export const verifyCode = async (req, res, next) => {
  try {
    const { mobileNumber, code } = req.body;
    if (!mobileNumber || !code)
      return res
        .status(400)
        .json({ error: "Mobile number and code are required" });

    const user = await User.findOne({ mobileNumber });
    if (!user) return res.status(404).json({ error: "User not found" });

    if (
      user.verificationCode !== code ||
      user.verificationCodeExpires < Date.now()
    ) {
      return res.status(400).json({ error: "Invalid or expired code" });
    }

    user.isVerified = true;
    user.verificationCode = null;
    user.verificationCodeExpires = null;
    await user.save();

    return res.json({ message: "Mobile number verified successfully. You can now log in." });
  } catch (error) {
    console.error("Verify Code Error:", error.message);
    return next(error);
  }
};

// Sign-in (request code)
export const login = async (req, res, next) => {
  try {
    const { mobileNumber, password } = req.body;
    if (!mobileNumber || !password) {
      return res.status(400).json({ error: "Mobile number and password are required" });
    }

    const user = await User.findOne({ mobileNumber }).select("+password");
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (!user.isVerified) {
      return res.status(403).json({ error: "Mobile number not verified. Please verify your mobile number first." });
    }
    if (!user.password) {
  return res.status(403).json({
    error: "You have not set a password yet. Please reset your password to continue."
  });
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

/**
 * @description Request a password reset OTP for an existing user.
 * @route POST /api/auth/forgot-password
 */
export const forgotPassword = async (req, res, next) => {
  try {
    const { mobileNumber } = req.body;
    if (!mobileNumber) {
      return res.status(400).json({ error: "Mobile number is required" });
    }

    const user = await User.findOne({ mobileNumber });
    if (!user) {
      return res.status(404).json({ error: "User with this mobile number does not exist." });
    }

    // Generate and send OTP
    const verificationCode = generateVerificationCode();
    user.verificationCode = verificationCode;
    user.verificationCodeExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save();

    // Send SMS via Twilio (if configured)
    if (client && twilioPhone && process.env.ENABLE_TWILIO_SMS === 'true') {
      try {
        await client.messages.create({
          body: `Jinnar Services App. Your password reset code is: ${verificationCode}`,
          from: "+17064802072",
          to: mobileNumber.toString(),
        });
        console.log(`Password reset SMS sent to ${mobileNumber}`);
      } catch (smsError) {
        console.error("Twilio SMS Error on password reset:", smsError.message);
        // Don't block the flow if SMS fails, user can still use the logged code in dev
      }
    } else {
      console.log("Twilio not configured; skipping SMS send for password reset.");
    }

    console.log(`Password reset code for ${mobileNumber}: ${verificationCode}`);

    res.status(200).json({ message: "Password reset code sent to your mobile number." , verificationCode });

  } catch (error) {
    console.error("Forgot Password Error:", error.message);
    return next(error);
  }
};

/**
 * @description Reset user password using the OTP.
 * @route POST /api/auth/reset-password
 */
export const resetPassword = async (req, res, next) => {
  try {
    const { mobileNumber, code, newPassword } = req.body;

    if (!mobileNumber || !code || !newPassword) {
      return res.status(400).json({ error: "Mobile number, code, and new password are required." });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long." });
    }

    const user = await User.findOne({ mobileNumber });
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // Check if the code is valid and not expired
    if (user.verificationCode !== code || user.verificationCodeExpires < Date.now()) {
      return res.status(400).json({ error: "Invalid or expired verification code." });
    }

    // Set the new password and clear the verification code fields
    user.password = newPassword;
    user.verificationCode = null;
    user.verificationCodeExpires = null;
    await user.save();

    // Log the user in by issuing a new token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.status(200).json({
      message: "Password has been reset successfully. You are now logged in.",
      token,
    });

  } catch (error) {
    console.error("Reset Password Error:", error.message);
    return next(error);
  }
};

// Additional auth-related controllers can be added here
