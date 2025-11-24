import express from "express";
import { protect, authorize, ROLES } from "../middleware/auth.js";
import { 
  createFAQ, 
  updateFAQ, 
  deleteFAQ,
  getAllFAQsAdmin,   // ← ADD
  bulkCreateFAQs     // ← ADD
} from "../controllers/FaqController.js";

const router = express.Router();

// ─────────────────────────────────────────────
// FAQ Management Routes (Admin Panel)
// Only Support Agents (Level 4+) can manage FAQs
// ─────────────────────────────────────────────

// CREATE
router.post(
  "/help",
  protect,
  authorize(ROLES.SUPPORT), // Level 4+
  createFAQ
);

// BULK CREATE
router.post(
  "/help/bulk",
  protect,
  authorize(ROLES.SUPPORT), // Level 4+
  bulkCreateFAQs
);

// UPDATE
router.patch(
  "/help/:id",
  protect,
  authorize(ROLES.SUPPORT),
  updateFAQ
);

// DELETE (Only supervisors and above)
router.delete(
  "/help/:id",
  protect,
  authorize(ROLES.SUPERVISOR), // Level 3+
  deleteFAQ
);

// GET ALL (Admin table view)
router.get(
  "/help",
  protect,
  authorize(ROLES.SUPPORT),
  getAllFAQsAdmin
);

export default router;
