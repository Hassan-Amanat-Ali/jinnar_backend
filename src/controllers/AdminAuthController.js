import User from "../models/User.js";
import jwt from "jsonwebtoken";
import { configDotenv } from "dotenv";
import { generateVerificationCode } from "../utils/helpers.js";
import { sendVerificationEmail } from "../services/emailService.js";

configDotenv();

export const adminLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Find the user by email, explicitly select password
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Check if the provided password matches the stored hashed password
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Critical Check: Ensure user.role is one of admin roles
    const adminRoles = ["support", "supervisor", "super_admin"];
    if (!adminRoles.includes(user.role)) {
      return res
        .status(403)
        .json({ error: "Access denied: Insufficient privileges" });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    // Remove password from the user object before sending response
    user.password = undefined;

    res.status(200).json({
      message: "Admin login successful",
      token,
      user: user,
    });
  } catch (error) {
    console.error("Admin Login Error:", error.message);
    return next(error);
  }
};

export const getMe = async (req, res, next) => {
  try {
    // User ID is attached to req.user by the authorize middleware
    const user = await User.findById(req.user.id).select("-password");

    if (!user) {
      return res.status(404).json({ error: "Admin user not found" });
    }

    // Critical Check: Ensure user.role is one of admin roles
    const adminRoles = ["support", "supervisor", "super_admin"];
    if (!adminRoles.includes(user.role)) {
      return res
        .status(403)
        .json({ error: "Access denied: Insufficient privileges" });
    }

    res.status(200).json({
      message: "Admin profile fetched successfully",
      user: user,
    });
  } catch (error) {
    console.error("Get Me Error:", error.message);
    return next(error);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    user.name = name;
    await user.save();

    res.json({ message: "Profile updated successfully", user: { name: user.name, email: user.email } });
  } catch (error) {
    console.error("Update Profile Error:", error.message);
    return next(error);
  }
};

export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current and new passwords are required" });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters long" });
    }

    const user = await User.findById(req.user.id).select("+password");
    if (!user) return res.status(404).json({ error: "User not found" });

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ error: "Incorrect current password" });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Change Password Error:", error.message);
    return next(error);
  }
};

export const initiateEmailUpdate = async (req, res, next) => {
  try {
    const { newEmail } = req.body;
    
    if (!newEmail) {
      return res.status(400).json({ error: "New email is required" });
    }

    const cleanEmail = newEmail.toLowerCase().trim();
    if (cleanEmail === req.user.email) {
      return res.status(400).json({ error: "New email must be different from current email" });
    }

    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(409).json({ error: "Email already in use" });
    }

    const user = await User.findById(req.user.id);
    const verificationCode = generateVerificationCode();

    user.tempContact = {
      type: 'email',
      value: cleanEmail,
      code: verificationCode,
      expires: Date.now() + 10 * 60 * 1000 // 10 minutes
    };
    
    await user.save();
    
    // Send to NEW email
    await sendVerificationEmail({ email: cleanEmail }, verificationCode, "verification");

    res.json({ message: `Verification code sent to ${cleanEmail}` });
  } catch (error) {
    console.error("Initiate Email Update Error:", error.message);
    return next(error);
  }
};

export const verifyEmailUpdate = async (req, res, next) => {
  try {
    const { code } = req.body;
    const user = await User.findById(req.user.id);

    if (!user.tempContact || user.tempContact.type !== 'email' || !user.tempContact.value) {
      return res.status(400).json({ error: "No pending email change request found" });
    }

    if (user.tempContact.expires < Date.now()) {
      return res.status(400).json({ error: "Verification code expired. Please request a new one." });
    }

    if (user.tempContact.code !== code) {
      return res.status(400).json({ error: "Invalid verification code" });
    }

    // Update Email
    user.email = user.tempContact.value;
    user.tempContact = undefined; // Clear temp data
    await user.save();

    res.json({ message: "Email updated successfully", email: user.email });
  } catch (error) {
    console.error("Verify Email Update Error:", error.message);
    return next(error);
  }
};

const AdminAuthController = {
  adminLogin,
  getMe,
  updateProfile,
  changePassword,
  initiateEmailUpdate,
  verifyEmailUpdate
};

export default AdminAuthController;
