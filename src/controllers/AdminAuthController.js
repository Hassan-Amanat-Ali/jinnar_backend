import User from "../models/User.js";
import jwt from "jsonwebtoken";
import { configDotenv } from "dotenv";

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

const AdminAuthController = {
  adminLogin,
  getMe,
};

export default AdminAuthController;
