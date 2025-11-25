import SupportTicket from "../models/SupportTicket.js";
import User from "../models/User.js";
import { sendPushNotification } from "../services/pushNotificationService.js";
import mongoose from "mongoose";

/**
 * @description Create a new support ticket
 * @route POST /api/support/tickets
 * @access Private
 */
export const createTicket = async (req, res) => {
  const { subject, message, attachments } = req.body;

  if (!subject || !message) {
    return res.status(400).json({ message: "Subject and message are required." });
  }

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const initialMessage = {
      sender: req.user.id,
      message,
      attachments: attachments || [],
    };

    const ticket = new SupportTicket({
      user: req.user.id,
      subject,
      conversation: [initialMessage],
    });

    const createdTicket = await ticket.save();

    // Notify admins
    const admins = await User.find({ role: { $in: ["admin", "super_admin"] } });
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

    res.status(201).json(createdTicket);
  } catch (error) {
    console.error("Error creating ticket:", error);
    res.status(500).json({ message: "Server error while creating ticket." });
  }
};

/**
 * @description Get all support tickets for the logged-in user
 * @route GET /api/support/tickets
 * @access Private
 */
export const getMyTickets = async (req, res) => {
  try {
    const tickets = await SupportTicket.find({ user: req.user.id })
      .populate("user", "name email")
      .populate("assignedTo", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json(tickets);
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
    const ticket = await SupportTicket.findById(req.params.id)
      .populate("user", "name email")
      .populate("assignedTo", "name email")
      .populate("conversation.sender", "name email role");

    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found." });
    }

    // Ensure regular users can only access their own tickets
    if (req.user.role !== "admin" && req.user.role !== "super_admin" && ticket.user._id.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized to view this ticket." });
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
    const isAdmin = req.user.role === "admin" || req.user.role === "super_admin";

    if (!isUserOwner && !isAdmin) {
      return res.status(403).json({ message: "Not authorized to reply to this ticket." });
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
        if (ticket.status === "resolved") {
            ticket.status = "open";
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
        const admins = await User.find({ role: { $in: ["admin", "super_admin"] } });
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
    if (user && user.fcmToken) {
      const notification = {
        title: `Ticket #${ticket.ticketId} Status Updated`,
        body: `The status of your support ticket has been updated to "${status.replace("_", " ")}".`,
        data: {
          ticketId: ticket._id.toString(),
        },
      };
      await sendPushNotification(user.fcmToken, notification);
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

  try {
    const ticket = await SupportTicket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found." });
    }

    const assignee = await User.findById(assigneeId);
    if (!assignee) {
        return res.status(404).json({ message: "Assignee user not found." });
    }

    if (assignee.role !== "admin" && assignee.role !== "super_admin") {
        return res.status(403).json({ message: "Can only assign tickets to administrators." });
    }

    ticket.assignedTo = assigneeId;
    const updatedTicket = await ticket.save();

    // Notify the assigned admin
    if (assignee.fcmTokens && assignee.fcmTokens.length > 0) {
      const notificationPromises = assignee.fcmTokens.map(tokenInfo => {
        const notification = {
          title: "You've Been Assigned a Ticket",
          body: `You have been assigned support ticket #${ticket.ticketId}.`,
          data: {
            ticketId: ticket._id.toString(),
          },
        };
        return sendPushNotification(tokenInfo.token, notification);
      });
      await Promise.all(notificationPromises);
    }

    // Also notify the user that their ticket has been assigned
    const user = await User.findById(ticket.user);
    if (user && user.fcmTokens && user.fcmTokens.length > 0) {
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
        .populate("conversation.sender", "name email role");

    res.status(200).json(populatedTicket);
  } catch (error) {
    console.error("Error assigning ticket:", error);
    res.status(500).json({ message: "Server error while assigning ticket." });
  }
};
