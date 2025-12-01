import SupportTicket from "../models/SupportTicket.js";
import User from "../models/User.js";
import { analyzeTicket, autoAssignTicket } from "../services/aiService.js";
import { sendPushNotification } from "../services/pushNotificationService.js";
import mongoose from "mongoose";

/**
 * @description Create a new support ticket
 * @route POST /api/support/tickets
 * @access Private
 */
export const createTicket = async (req, res) => {
  const { subject, message, attachments } = req.body;
  let ticketSubject = subject;

  if (!message) {
    return res.status(400).json({ message: "Message is required." });
  }

  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found." });

    if (!ticketSubject) {
      ticketSubject = "Ticket from user message"; // Placeholder for AI to fill
    }

    const existingTicket = await SupportTicket.findOne({
      user: req.user.id,
      subject: ticketSubject.trim(),
      status: { $in: ["open", "in_progress"] },
    });
    if (existingTicket) {
      return res.status(400).json({ message: "You already have an open ticket with this subject." });
    }

    const isAdmin = ['support', 'supervisor', 'super_admin'].includes(req.user.role);

    const ticketData = {
      user: req.user.id,
      subject: ticketSubject,
      conversation: [{ sender: req.user.id, message, attachments: attachments || [] }],
    };

    if (isAdmin && req.body.priority) ticketData.priority = req.body.priority;
    if (isAdmin && req.body.category) ticketData.category = req.body.category;

    const ticket = new SupportTicket(ticketData);
    const createdTicket = await ticket.save();

    // Respond to the user first to provide a quick experience
    res.status(201).json(createdTicket);

    // --- Start background processing ---

    // 1. Run AI Analysis
    await analyzeTicket(createdTicket._id);
    
    // 2. Auto-assign ticket
    autoAssignTicket(createdTicket._id);

    // 3. Check for high-confidence auto-reply
    const analyzedTicket = await SupportTicket.findById(createdTicket._id);
    if (analyzedTicket && analyzedTicket.aiAnalysis.confidenceScore > 0.95 && analyzedTicket.aiAnalysis.suggestedResponse) {
      const systemAgent = await User.findOne({ role: 'super_admin' });
      if (systemAgent) {
        const reply = {
          sender: systemAgent._id,
          message: analyzedTicket.aiAnalysis.suggestedResponse,
          attachments: [],
        };
        analyzedTicket.conversation.push(reply);
        analyzedTicket.status = 'resolved'; // AI is confident, so we can mark as resolved
        await analyzedTicket.save();

        // Notify the user who created the ticket about the auto-reply
        if (user.fcmTokens && user.fcmTokens.length > 0) {
          const notification = {
            title: `Update on Ticket #${analyzedTicket.ticketId}`,
            body: 'Our AI assistant has posted a response to your ticket.',
            data: { ticketId: analyzedTicket._id.toString() },
          };
          const notificationPromises = user.fcmTokens.map(tokenInfo => 
            sendPushNotification(tokenInfo.token, notification)
          );
          await Promise.all(notificationPromises);
          console.log(`🤖 Auto-replied to ticket ${analyzedTicket.ticketId}`);
        }
      }
    }

    // 4. Notify human admins about the new ticket
    const admins = await User.find({ role: { $in: ["support", "supervisor"] } }); // No need to notify super_admin if they are the sender
    const notificationPromises = admins.flatMap((admin) => {
      if (!admin.fcmTokens || admin.fcmTokens.length === 0) return [];
      return admin.fcmTokens.map(tokenInfo => {
        const notification = {
          title: "New Support Ticket",
          body: `A new ticket has been created by ${user.name}.`,
          data: { ticketId: createdTicket._id.toString() },
        };
        return sendPushNotification(tokenInfo.token, notification);
      });
    });
    await Promise.all(notificationPromises);

  } catch (error) {
    console.error("Error creating ticket:", error);
    // Since we already sent a response, we just log the error for background tasks
  }
};


/**
 * @description Get all support tickets for the logged-in user
 * @route GET /api/support/tickets
 * @access Private
 */
export const getMyTickets = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query; // default: page 1, 10 tickets per page
    const skip = (page - 1) * limit;

    const total = await SupportTicket.countDocuments({ user: req.user.id });

    const tickets = await SupportTicket.find({ user: req.user.id })
      .populate("user", "name email")
      .populate("assignedTo", "name email")
      .sort({ createdAt: -1 })
      .skip(Number(skip))
      .limit(Number(limit));

    res.status(200).json({
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit),
      totalTickets: total,
      tickets,
    });
  } catch (error) {
    console.error("Error fetching user tickets:", error);
    res.status(500).json({ message: "Server error while fetching tickets." });
  }
};


/**
 * @description Get a single support ticket by ID
 * @route GET /api/support/tickets/:id
 * @access Private
 */
export const getTicketById = async (req, res) => {
  try {
    const isAdmin = ['support', 'supervisor', 'super_admin'].includes(req.user.role);
    
    let ticket = await SupportTicket.findById(req.params.id)
      .populate("user", "name email")
      .populate("assignedTo", "name email")
      .populate("conversation.sender", "name email role");

    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found." });
    }

    // Ensure regular users can only access their own tickets
    if (!isAdmin && ticket.user._id.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized to view this ticket." });
    }

    // Populate internalNotes for admins, filter out for non-admin users
    if (isAdmin) {
      ticket = await SupportTicket.findById(req.params.id)
        .populate("user", "name email")
        .populate("assignedTo", "name email")
        .populate("internalNotes.agentId", "name email role")
        .populate("conversation.sender", "name email role");
    } else {
      // Filter out internalNotes for non-admin users
      ticket = ticket.toObject();
      delete ticket.internalNotes;
      ticket = JSON.parse(JSON.stringify(ticket));
    }

    res.status(200).json(ticket);
  } catch (error) {
    console.error("Error fetching ticket by ID:", error);
    res.status(500).json({ message: "Server error while fetching ticket." });
  }
};

/**
 * @description Reply to a support ticket
 * @route POST /api/support/tickets/:id/reply
 * @access Private
 */
export const replyToTicket = async (req, res) => {
  const { message, attachments } = req.body;

  if (!message) {
    return res.status(400).json({ message: "Message is required." });
  }

  try {
    const ticket = await SupportTicket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found." });
    }

    const isUserOwner = ticket.user?.toString() === req.user.id;
    const isAdmin = ['support', 'supervisor', 'super_admin'].includes(req.user.role);

    if (!isUserOwner && !isAdmin) {
      return res.status(403).json({ message: "Not authorized to reply to this ticket." });
    }

    // Users cannot reply to closed tickets
    if (isUserOwner && ticket.status === "closed") {
      return res.status(403).json({ message: "Cannot reply to a closed ticket." });
    }

    const reply = {
      sender: req.user.id,
      message,
      attachments: attachments || [],
    };

    ticket.conversation.push(reply);

    // If an admin replies, set status to 'in_progress', if user replies and status was 'resolved', reopen it.
    if (isAdmin) {
      if (ticket.status === "open" || ticket.status === "resolved") {
        ticket.status = "in_progress";
      }
    } else if (isUserOwner) {
      // User can re-open a resolved ticket
      if (ticket.status === "resolved") {
        ticket.status = "open";
        ticket.reopenedAt = new Date();
        ticket.reopenedCount = (ticket.reopenedCount || 0) + 1;
      }
    }

    const updatedTicket = await ticket.save();

    // Notify the other party
    if (isAdmin) {
      // Admin is replying, notify the user who created the ticket
      const user = await User.findById(ticket.user);
      if (user && user.fcmTokens && user.fcmTokens.length > 0) {
        const notificationPromises = user.fcmTokens.map(tokenInfo => {
          const notification = {
            title: `New Reply on Ticket #${ticket.ticketId}`,
            body: `An admin has replied to your support ticket.`,
            data: { ticketId: ticket._id.toString() },
          };
          return sendPushNotification(tokenInfo.token, notification);
        });
        await Promise.all(notificationPromises);
      }
    } else {
      // User is replying
      const senderUser = await User.findById(req.user.id);
      const notification = {
        title: `New Reply on Ticket #${ticket.ticketId}`,
        body: `${senderUser.name} has replied to a support ticket.`,
        data: { ticketId: ticket._id.toString() },
      };

      if (ticket.assignedTo) {
        // Notify the assigned admin
        const assignedAdmin = await User.findById(ticket.assignedTo);
        if (assignedAdmin && assignedAdmin.fcmTokens && assignedAdmin.fcmTokens.length > 0) {
          const notificationPromises = assignedAdmin.fcmTokens.map(tokenInfo => 
            sendPushNotification(tokenInfo.token, notification)
          );
          await Promise.all(notificationPromises);
        }
      } else {
        // If not assigned, notify all admins
        const admins = await User.find({ role: { $in: ["support", "supervisor", "super_admin"] } });
        const notificationPromises = admins.flatMap(admin => 
          admin.fcmTokens.map(tokenInfo => sendPushNotification(tokenInfo.token, notification)));
        await Promise.all(notificationPromises);
      }
    }

    const populatedTicket = await SupportTicket.findById(updatedTicket._id)
        .populate("user", "name email")
        .populate("assignedTo", "name email")
        .populate("conversation.sender", "name email role");

    res.status(200).json(populatedTicket);
  } catch (error) {
    console.error("Error replying to ticket:", error);
    res.status(500).json({ message: "Server error while replying to ticket." });
  }
};

// ===============================================================================================
// ADMIN CONTROLLERS
// ===============================================================================================

/**
 * @description Get all support tickets (for admins)
 * @route GET /api/admin/support/tickets
 * @access Private (Admin)
 */
export const getAllTickets = async (req, res) => {
  const { status, priority, sort = "-createdAt" } = req.query;
  const query = {};

  if (status) {
    query.status = status;
  }
  if (priority) {
    query.priority = priority;
  }

  try {
    const tickets = await SupportTicket.find(query)
      .populate("user", "name email")
      .populate("assignedTo", "name email")
      .populate("internalNotes.agentId", "name email role")
      .sort(sort);

    res.status(200).json(tickets);
  } catch (error) {
    console.error("Error fetching all tickets:", error);
    res.status(500).json({ message: "Server error while fetching all tickets." });
  }
};

/**
 * @description Update the status of a support ticket (for admins)
 * @route PUT /api/admin/support/tickets/:id/status
 * @access Private (Admin)
 */
export const updateTicketStatus = async (req, res) => {
  const { status } = req.body;
  const validStatuses = ["open", "in_progress", "resolved", "closed"];

  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ message: "Invalid status provided." });
  }

  try {
    const ticket = await SupportTicket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found." });
    }

    ticket.status = status;

    if (status === "resolved") {
      ticket.resolvedBy = req.user.id;
    }

    const updatedTicket = await ticket.save();

    // Notify user of status change
    const user = await User.findById(ticket.user);
    if (user && user.fcmTokens && user.fcmTokens.length > 0) {
      const notification = {
        title: `Ticket #${ticket.ticketId} Status Updated`,
        body: `The status of your support ticket has been updated to "${status.replace("_", " ")}".`,
        data: {
          ticketId: ticket._id.toString(),
        },
      };
      const notificationPromises = user.fcmTokens.map(tokenInfo => 
        sendPushNotification(tokenInfo.token, notification)
      );
      await Promise.all(notificationPromises);
    }

    const populatedTicket = await SupportTicket.findById(updatedTicket._id)
        .populate("user", "name email")
        .populate("assignedTo", "name email")
        .populate("conversation.sender", "name email role");

    res.status(200).json(populatedTicket);
  } catch (error) {
    console.error("Error updating ticket status:", error);
    res.status(500).json({ message: "Server error while updating ticket status." });
  }
};

/**
 * @description Assign a support ticket to an admin (for admins)
 * @route PUT /api/admin/support/tickets/:id/assign
 * @access Private (Admin)
 */
export const assignTicket = async (req, res) => {
  const { assigneeId } = req.body;

  if (!mongoose.Types.ObjectId.isValid(assigneeId)) {
    return res.status(400).json({ message: "Invalid assignee ID." });
  }

  // Double-check authorization within the controller for added security
  const canAssignRoles = ['supervisor', 'super_admin'];
  if (!canAssignRoles.includes(req.user.role)) {
    return res.status(403).json({ message: "You do not have permission to assign tickets." });
  }

  try {
    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: "Ticket not found." });

    const assignee = await User.findById(assigneeId);
    if (!assignee) return res.status(404).json({ message: "Assignee user not found." });
    if (!['support', 'supervisor', 'super_admin'].includes(assignee.role)) {
      return res.status(403).json({ message: "Can only assign tickets to administrators." });
    }

    // LOG PREVIOUS ASSIGNMENT
    if (ticket.assignedTo) {
      ticket.assignmentHistory.push({
        assignedBy: req.user.id,
        assignedTo: ticket.assignedTo,
        assignedAt: new Date(),
      });
    }

    // ASSIGN NEW ADMIN
    ticket.assignedTo = assigneeId;
    ticket.assignmentHistory.push({
      assignedBy: req.user.id,
      assignedTo: assigneeId,
      assignedAt: new Date(),
    });

    const updatedTicket = await ticket.save();

    // Notify the assigned admin
    if (assignee.fcmTokens?.length > 0) {
      const notificationPromises = assignee.fcmTokens.map(tokenInfo => {
        const notification = {
          title: "You've Been Assigned a Ticket",
          body: `You have been assigned support ticket #${ticket.ticketId}.`,
          data: { ticketId: ticket._id.toString() },
        };
        return sendPushNotification(tokenInfo.token, notification);
      });
      await Promise.all(notificationPromises);
    }

    // Notify ticket owner
    const user = await User.findById(ticket.user);
    if (user?.fcmTokens?.length > 0) {
      const notificationPromises = user.fcmTokens.map(tokenInfo => {
        const userNotification = {
          title: `Ticket #${ticket.ticketId} Assigned`,
          body: `Your support ticket has been assigned to an agent.`,
          data: { ticketId: ticket._id.toString() },
        };
        return sendPushNotification(tokenInfo.token, userNotification);
      });
      await Promise.all(notificationPromises);
    }

    const populatedTicket = await SupportTicket.findById(updatedTicket._id)
      .populate("user", "name email")
      .populate("assignedTo", "name email")
      .populate("conversation.sender", "name email role")
      .populate("assignmentHistory.assignedBy", "name email")
      .populate("assignmentHistory.assignedTo", "name email");

    res.status(200).json(populatedTicket);
  } catch (error) {
    console.error("Error assigning ticket:", error);
    res.status(500).json({ message: "Server error while assigning ticket." });
  }
};


/**
 * @description Add an internal note to a support ticket (for admins)
 * @route POST /api/admin/support/tickets/:id/internal-note
 * @access Private (Admin)
 */
export const addInternalNote = async (req, res) => {
  const { note } = req.body;

  if (!note || !note.trim()) {
    return res.status(400).json({ message: "Note is required." });
  }

  try {
    const ticket = await SupportTicket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found." });
    }

    // Add internal note (separate from conversation)
    ticket.internalNotes.push({
      agentId: req.user.id,
      note: note.trim(),
      createdAt: new Date(),
    });

    const updatedTicket = await ticket.save();

    const populatedTicket = await SupportTicket.findById(updatedTicket._id)
      .populate("user", "name email")
      .populate("assignedTo", "name email")
      .populate("internalNotes.agentId", "name email role")
      .populate("conversation.sender", "name email role");

    res.status(200).json(populatedTicket);
  } catch (error) {
    console.error("Error adding internal note:", error);
    res.status(500).json({ message: "Server error while adding internal note." });
  }
};

/**
 * @description Get all tickets assigned to the logged-in admin
 * @route GET /api/admin/support/tickets/assigned
 * @access Private (Admin)
 */
export const getMyAssignedTickets = async (req, res) => {
  try {
    const tickets = await SupportTicket.find({ assignedTo: req.user.id })
      .populate("user", "name email")
      .populate("assignedTo", "name email")
      .populate("internalNotes.agentId", "name email role")
      .sort({ createdAt: -1 });

    res.status(200).json(tickets);
  } catch (error) {
    console.error("Error fetching assigned tickets:", error);
    res.status(500).json({ message: "Server error while fetching assigned tickets." });
  }
};
