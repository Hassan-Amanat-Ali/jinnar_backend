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

// Register user with email
export const registerUser = async (req, res) => {
  try {
    const { email, role, name = "", password } = req.body;

    // Validate inputs
    if (!email || !role || !password) {
      return res
        .status(400)
        .json({ error: "Email, role, and password are required" });
    }
    if (!["buyer", "seller"].includes(role)) {
      return res.status(400).json({ error: "Role must be buyer or seller" });
    }
    if (role === "seller" && !name) {
      return res
        .status(400)
        .json({ error: "Name is required for seller role" });
    }
    // Email validation
    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(email)) {
      return res
        .status(400)
        .json({
          error: "Invalid email format",
        });
    }

    // Check if user exists by email
    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res
        .status(409)
        .json({ error: "Email already registered" });
    }

    // Create user
    const user = new User({
      email: email.toLowerCase().trim(),
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

    // TODO: Send email verification (email service to be configured)
    // For now, OTP is returned in response for testing/migration
    console.log(`Verification code for ${email}: ${verificationCode}`);

    return res
      .status(201)
      .json({ message: "Verification code sent to email", verificationCode });
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
    const { email, code } = req.body;
    if (!email || !code)
      return res
        .status(400)
        .json({ error: "Email and code are required" });

    const user = await User.findOne({ email: email.toLowerCase().trim() });
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

    return res.json({ message: "Email verified successfully. You can now log in." });
  } catch (error) {
    console.error("Verify Code Error:", error.message);
    return next(error);
  }
};

// Sign-in
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select("+password");
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (!user.isVerified) {
      return res.status(403).json({ error: "Email not verified. Please verify your email first." });
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
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(404).json({ error: "User with this email does not exist." });
    }

    // Generate and send OTP
    const verificationCode = generateVerificationCode();
    user.verificationCode = verificationCode;
    user.verificationCodeExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save();

    // TODO: Send email with password reset code (email service to be configured)
    // For now, OTP is returned in response for testing/migration
    console.log(`Password reset code for ${email}: ${verificationCode}`);

    res.status(200).json({ message: "Password reset code sent to your email.", verificationCode });

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
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: "Email, code, and new password are required." });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long." });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
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
