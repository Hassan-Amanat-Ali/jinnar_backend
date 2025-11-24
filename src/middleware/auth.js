import jwt from "jsonwebtoken";
import User from "../models/User.js"; // Import your User model

// Export ROLES so you can use them in your Routes file
export const ROLES = {
  BUYER: "buyer",
  SELLER: "seller",
  SUPPORT: "support",
  SUPERVISOR: "supervisor",
  REGIONAL_MANAGER: "regional_manager",
  SUPER_ADMIN: "super_admin",
};

const roleHierarchy = {
  [ROLES.SUPER_ADMIN]: 1,
  [ROLES.REGIONAL_MANAGER]: 2,
  [ROLES.SUPERVISOR]: 3,
  [ROLES.SUPPORT]: 4,
  [ROLES.SELLER]: 5,
  [ROLES.BUYER]: 5,
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. PROTECT (Authentication)
// ─────────────────────────────────────────────────────────────────────────────
export const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(" ")[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // 🔴 SECURITY FIX: Get user from DB to check current status
      // We exclude password to keep it light
      const user = await User.findById(decoded.id).select("-password");

      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      // 🔴 CHECK SUSPENSION
      if (user.isSuspended) {
         return res.status(403).json({ 
           error: "Account Suspended", 
           reason: user.suspensionDetails?.reason 
         });
      }

      // Attach user to request object
      req.user = user; 
      next();
    } catch (error) {
      console.error("Auth Error:", error.message);
      return res.status(401).json({ error: "Not authorized, token failed" });
    }
  }

  if (!token) {
    res.status(401).json({ error: "Not authorized, no token" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. AUTHORIZE (RBAC)
// ─────────────────────────────────────────────────────────────────────────────
export const authorize = (rolesParam) => {
  return (req, res, next) => {
    const userRole = req.user?.role;

    if (!userRole || !roleHierarchy[userRole]) {
      return res.status(403).json({ error: "Forbidden: Invalid user role." });
    }

    const userLevel = roleHierarchy[userRole];

    // 1. Normalize input: Ensure we always work with an array, even if a string is passed
    const allowedRoles = Array.isArray(rolesParam) ? rolesParam : [rolesParam];

    // 2. Find the "Lowest Rank" (Highest Number) allowed in the list.
    // Example: If you pass ["support", "super_admin"], levels are [4, 1].
    // The "Minimum Requirement" is Level 4 (Support). 
    // Anyone with Level 4 OR BETTER (3, 2, 1) can enter.
    const minRequiredLevel = Math.max(
      ...allowedRoles.map((role) => roleHierarchy[role] || 0)
    );

    // 3. Check Permission
    // Lower Number = Higher Power (1 is greater than 4 in this system)
    if (userLevel <= minRequiredLevel) {
      return next();
    } else {
      return res.status(403).json({
        error: `Forbidden: You do not have permission. Your role (${userRole}) is Level ${userLevel}, but this route requires Level ${minRequiredLevel} or better.`,
      });
    }
  };
};