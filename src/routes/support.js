import express from "express";
import {
  createTicket,
  getMyTickets,
  getTicketById,
  replyToTicket,
} from "../controllers/SupportTicketController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// @route   /api/support
router.post("/tickets", createTicket);
router.get("/tickets", protect, getMyTickets);
router.get("/tickets/:id", protect, getTicketById);
router.post("/tickets/:id/reply", protect, replyToTicket);

export default router;
