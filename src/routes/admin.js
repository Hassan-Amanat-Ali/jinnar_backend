import express from "express";
import AdminController from "../controllers/adminController.js";
import * as AdminAuthController from "../controllers/AdminAuthController.js";
import { 
  getAllTickets, 
  getTicketById, 
  replyToTicket,
  updateTicketStatus,
  assignTicket
} from "../controllers/SupportTicketController.js";

import { protect, authorize } from "../middleware/auth.js"; // Assuming this handles strings
import { 
  getAllReports, 
  getReportDetails, 
  updateReportStatus 
} from "../controllers/ReportController.js";

const router = express.Router();

// =============================================================================
// Support Ticket System
// =============================================================================
router.get(
  "/tickets", 
  protect, 
  authorize("support", "supervisor", "super_admin"), 
  getAllTickets
);

router.get(
  "/tickets/:id",
  protect,
  authorize("support", "supervisor", "super_admin"),
  getTicketById
);

router.post(
  "/tickets/:id/reply", 
  protect, 
  authorize("support", "supervisor", "super_admin"), 
  replyToTicket
);

router.put(
  "/tickets/:id/status",
  protect,
  authorize("support", "supervisor", "super_admin"),
  updateTicketStatus
);

router.put(
  "/tickets/:id/assign",
  protect,
  authorize("supervisor", "super_admin"),
  assignTicket
);


// =============================================================================
// 0. Report/Complaint System (Public/Self)
// =============================================================================


router.get(
  "/reports",
  protect, // Make sure these are imported
  authorize("support"), 
  getAllReports
);

router.get(
  "/reports/:id",
  protect,
  authorize("support"),
  getReportDetails
);

router.patch(
  "/reports/:id",
  protect,
  authorize("supervisor"), // Only Supervisors can close reports
  updateReportStatus
);

// =============================================================================
// 1. AUTHENTICATION (Public/Self)
// =============================================================================

router.post("/login", AdminAuthController.adminLogin); // Make sure to use the new adminLogin we made!

// Get My Profile
router.get(
  "/me",
  protect,
  authorize(["support", "supervisor", "super_admin"]),
  AdminAuthController.getMe
);

// =============================================================================
// 2. SUPER ADMIN: TEAM MANAGEMENT (NEW!)
// =============================================================================
router.use(protect); // Apply protect to everything below

// Create a new Admin User (Invite)
router.post(
  "/create-admin",
  authorize("super_admin"), // Strict: Only Owner can do this
  AdminController.createSubAdmin
);

// Reset any user's password
router.patch(
  "/users/:id/reset-password",
  authorize("super_admin"),
  AdminController.forceResetPassword
);

// --- Full Admin Management ---

// Get all admins
router.get(
  "/admins",
  authorize("super_admin"),
  AdminController.getAdmins
);

// Get a single admin by ID
router.get(
  "/admins/:id",
  authorize("super_admin"),
  AdminController.getAdminById
);

// Update an admin's role or status
router.patch(
  "/admins/:id",
  authorize("super_admin"),
  AdminController.updateAdmin
);

// Delete an admin
router.delete(
  "/admins/:id",
  authorize("super_admin"),
  AdminController.deleteAdmin
);



// =============================================================================
// 3. DASHBOARD & STATS
// =============================================================================
router.get(
  "/stats",
  authorize(["support", "supervisor", "super_admin"]),
  AdminController.getDashboardStats
);

router.get(
  "/financial-logs",
  authorize("super_admin"),
  AdminController.viewFinancialLogs
);

// =============================================================================
// 4. USER MANAGEMENT (Buyers/Sellers)
// =============================================================================
router.get(
  "/users", 
  authorize("support"), // Support+ can view
  AdminController.getAllUsers
);

router.get(
  "/user-activity/:userId",
  authorize("support"),
  AdminController.viewUserActivity
);

router.patch( // Changed from POST to PATCH for semantic correctness
  "/verify-user",
  authorize("supervisor"), // Supervisor+ can verify
  AdminController.verifyUser
);

router.patch( // Changed from POST to PATCH
  "/suspend-user",
  authorize("supervisor"),
  AdminController.suspendUser
);

// =============================================================================
// 5. CONTENT MANAGEMENT (Skills/Categories)
// =============================================================================
router.post(
  "/categories",
  authorize("super_admin"),
  AdminController.createCategory
);

router.get(
  "/categories",
  authorize(["support", "supervisor", "super_admin"]),
  AdminController.getCategories
);

router.patch(
  "/categories/:id",
  authorize("super_admin"),
  AdminController.updateCategory
);

router.delete(
  "/categories/:id",
  authorize("super_admin"),
  AdminController.deleteCategory
);

// =============================================================================
// 6. GIG MANAGEMENT
// =============================================================================
router.get(
  "/gigs",
  authorize(["support", "supervisor", "super_admin"]),
  AdminController.getAllGigs
);

router.patch(
  "/gigs/:id/status",
  authorize(["supervisor", "super_admin"]),
  AdminController.updateGigStatus
);

router.delete(
  "/gigs/:id",
  authorize("super_admin"),
  AdminController.deleteGig
);

// =============================================================================
// 7. ORDER MANAGEMENT
// =============================================================================
router.get(
  "/orders",
  authorize(["support", "supervisor", "super_admin"]),
  AdminController.getAllOrders
);

router.get(
  "/orders/:id",
  authorize(["support", "supervisor", "super_admin"]),
  AdminController.getOrderDetails
);

router.patch(
  "/orders/:id/cancel",
  authorize(["supervisor", "super_admin"]),
  AdminController.adminCancelOrder
);

// =============================================================================
// 8. PLATFORM SETTINGS
// =============================================================================
router.post( // Or PATCH
  "/settings",
  authorize("super_admin"),
  AdminController.updatePlatformSettings
);

export default router;