import express from "express";
import AdminController from "../controllers/adminController.js";
// Ensure you are importing this correctly based on your previous fix
import * as AdminAuthController from "../controllers/AdminAuthController.js";
import { protect } from "../middleware/auth.js";
import { authorize } from "../middleware/authorize.js";

const router = express.Router();

// --- Auth Routes ---
router.post("/login", AdminAuthController.login);
router.get(
  "/me",
  protect,
  authorize(["support", "supervisor", "super_admin"]),
  AdminAuthController.getMe,
);

// --- Protected Routes ---
router.use(protect); // Apply authentication to everything below

// 1. DASHBOARD STATS (This was missing!)
// We allow all admin levels (support, supervisor, super_admin) to view stats
router.get(
  "/stats",
  authorize(["support", "supervisor", "super_admin"]),
  AdminController.getDashboardStats,
);

// 2. User Management
router.get("/users", authorize("support"), AdminController.getAllUsers);
router.get(
  "/user-activity/:userId",
  authorize("support"),
  AdminController.viewUserActivity,
);
router.post(
  "/verify-user",
  authorize("supervisor"),
  AdminController.verifyUser,
);
router.post(
  "/suspend-user",
  authorize("supervisor"),
  AdminController.suspendUser,
);

// 3. Super Admin Features
router.post(
  "/settings",
  authorize("super_admin"),
  AdminController.updatePlatformSettings,
);
router.get(
  "/financial-logs",
  authorize("super_admin"),
  AdminController.viewFinancialLogs,
);

// --- GIG MANAGEMENT ---
// Support can view gigs
router.get(
  "/gigs",
  authorize(["support", "supervisor", "super_admin"]),
  AdminController.getAllGigs,
);

// Supervisors can approve/reject gigs
router.patch(
  "/gigs/:id/status",
  authorize(["supervisor", "super_admin"]),
  AdminController.updateGigStatus,
);

// Super Admin can permanently delete gigs
router.delete("/gigs/:id", authorize("super_admin"), AdminController.deleteGig);

// --- ORDER MANAGEMENT (DISPUTES) ---
// View all orders (Support+)
router.get(
  "/orders",
  authorize(["support", "supervisor", "super_admin"]),
  AdminController.getAllOrders,
);

// View specific order details (Support+)
router.get(
  "/orders/:id",
  authorize(["support", "supervisor", "super_admin"]),
  AdminController.getOrderDetails,
);

// Force Cancel Order (Supervisor+) - Used when a seller scams or goes missing
router.patch(
  "/orders/:id/cancel",
  authorize(["supervisor", "super_admin"]),
  AdminController.adminCancelOrder,
);
export default router;
