import SupportTicket from "../models/SupportTicket.js";
import User from "../models/User.js";
// WARNING: Ensure your aiService.js now contains the template matching logic
import { analyzeTicket, autoAssignTicket } from "../services/aiService.js"; 
import { sendPushNotification } from "../services/pushNotificationService.js";
import mongoose from "mongoose";
import nodemailer from "nodemailer"; 
import { configDotenv } from "dotenv"; 

configDotenv(); 

// ===============================================================================================
// EMAIL TRANSPORT SETUP 
// ===============================================================================================

const transporter = nodemailer.createTransport({
  host: "127.0.0.1", 
  port: 587,
  secure: false, 
  auth: {
    user: process.env.SMTP_USER, 
    pass: process.env.SMTP_PASS, 
  },
  tls: {
    rejectUnauthorized: false
  }
});

const sendEmail = async (to, subject, htmlBody) => {
    try {
        await transporter.sendMail({
            from: process.env.FROM_EMAIL || 'support@jinnar.com',
            to: to,
            subject: subject,
            html: htmlBody,
        });
        console.log(`📧 Email sent successfully to ${to}`);
    } catch (error) {
        console.error(`❌ Failed to send email to ${to}:`, error.message);
    }
};


// ===============================================================================================
// CORE TICKET CONTROLLERS
// ===============================================================================================

/**
 * Helper to notify admins of a new ticket 
 */
const notifyAdminsOfNewTicket = async (ticket, userName) => {
  try {
    const admins = await User.find({ role: { $in: ["support", "supervisor", "super_admin"] } });
    const notificationPromises = admins.flatMap((admin) => {
      if (!admin.fcmTokens || admin.fcmTokens.length === 0) return [];
      return admin.fcmTokens.map(tokenInfo => {
        return sendPushNotification(tokenInfo.token, {
          title: "New Support Ticket",
          body: `New ticket from ${userName}.`,
          data: { ticketId: ticket._id.toString() },
        });
      });
    });
    await Promise.all(notificationPromises);
  } catch (e) {
    console.error("Failed to notify admins", e);
  }
};


/**
 * @description Create a new support ticket
 */
export const createTicket = async (req, res) => {
  const { subject, message, attachments, guestInfo } = req.body;
  
  if (!message) {
    return res.status(400).json({ message: "Message is required." });
  }

  let userId = null;
  let userData = null;
  let ticketSubject = subject;

  try {
    if (req.user && req.user.id) {
      userId = req.user.id;
      userData = await User.findById(userId);
      
      if (!userData) return res.status(404).json({ message: "User not found." });
      if (!ticketSubject) ticketSubject = "Ticket from user message";

      const existingTicket = await SupportTicket.findOne({
        user: userId,
        subject: ticketSubject.trim(),
        status: { $in: ["open", "in_progress"] },
      });

      if (existingTicket) {
        return res.status(400).json({ message: "You already have an open ticket with this subject." });
      }

    } else {
      if (!guestInfo || !guestInfo.email || !guestInfo.name) {
        return res.status(400).json({ message: "Guest email and name are required." });
      }
      
      if (!ticketSubject) ticketSubject = `Support Request from ${guestInfo.name}`;
    }

    const ticketData = {
      subject: ticketSubject,
      user: userId || undefined, 
      guestInfo: userId ? undefined : guestInfo,
      conversation: [
        { 
          sender: userId || null, 
          message, 
          attachments: attachments || [] 
        }
      ],
    };

    if (userData && ['support', 'supervisor', 'super_admin'].includes(userData.role)) {
      if (req.body.priority) ticketData.priority = req.body.priority;
      if (req.body.category) ticketData.category = req.body.category;
    }

    const ticket = new SupportTicket(ticketData);
    const createdTicket = await ticket.save();

    res.status(201).json(createdTicket);

    // --- BACKGROUND TASKS (Ensuring AI services run in sequence) ---
    
    // 1. Auto-Assign first (to determine assigned agent's role)
    autoAssignTicket(createdTicket._id)
      // 2. Then run AI analysis (which uses the newly assigned agent's role for template matching)
      .then(() => analyzeTicket(createdTicket._id))
      .catch(err => console.error("Background task failed:", err));


    // C. Notifications (The Logic Split)
    if (userId && userData) {
      notifyAdminsOfNewTicket(createdTicket, userData.name);
      
    } else {
      // Guest Confirmation Email (Template 1)
      const emailHtml = `
          <p>Hi ${guestInfo.name},</p>
          <p>We confirm that your support request (${createdTicket.subject}) has been successfully created (Ticket ID: #${createdTicket.ticketId}).</p>
          <p>A member of our team will review your message shortly and reply to this email address.</p>
          <p>Thank you for reaching out.</p>
          <p>Sincerely, Jinnar Support Team</p>
      `;
      sendEmail(guestInfo.email, `Ticket Created: #${createdTicket.ticketId}`, emailHtml);

      notifyAdminsOfNewTicket(createdTicket, guestInfo.name + " (Guest)");
    }

  } catch (error) {
    console.error("Error creating ticket:", error);
    if (!res.headersSent) {
      res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
  }
};


/**
 * @description Get all support tickets for the logged-in user
 */
export const getMyTickets = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query; 
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

    if (!isAdmin && ticket.user?._id.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized to view this ticket." });
    }

    if (isAdmin) {
      ticket = await SupportTicket.findById(req.params.id)
        .populate("user", "name email")
        .populate("assignedTo", "name email")
        .populate("internalNotes.agentId", "name email role")
        .populate("conversation.sender", "name email role");
    } else {
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

    if (isUserOwner && ticket.status === "closed") {
      return res.status(403).json({ message: "Cannot reply to a closed ticket." });
    }

    const reply = {
      sender: req.user.id,
      message,
      attachments: attachments || [],
    };

    ticket.conversation.push(reply);

    if (isAdmin) {
      if (ticket.status === "open" || ticket.status === "resolved") {
        ticket.status = "in_progress";
      }
    } else if (isUserOwner) {
      if (ticket.status === "resolved") {
        ticket.status = "open";
        ticket.reopenedAt = new Date();
        ticket.reopenedCount = (ticket.reopenedCount || 0) + 1;
      }
    }

    const updatedTicket = await ticket.save();

    // --- NOTIFICATION LOGIC ---
    if (isAdmin) {
      const isGuestTicket = !ticket.user && ticket.guestInfo && ticket.guestInfo.email;
      
      if (isGuestTicket) {
        // ADMIN REPLIED TO GUEST: Send Email
        const emailHtml = `
            <p>Hi ${ticket.guestInfo.name},</p>
            <p>A support agent has replied to your support ticket #${ticket.ticketId} (Subject: ${ticket.subject}).</p>
            <div style="padding: 15px; border-left: 4px solid #469DD7; background-color: #f3f4f6; margin: 10px 0;">
                <strong>Reply:</strong> ${message}
            </div>
            <p>You may reply directly to this email to continue the conversation.</p>
            <p>Sincerely, Jinnar Support Team</p>
        `;
        sendEmail(ticket.guestInfo.email, `Reply on Ticket: #${ticket.ticketId}`, emailHtml);

      } else if (ticket.user) {
        // ADMIN REPLIED TO LOGGED-IN USER: Send Push Notification
        const user = await User.findById(ticket.user);
        if (user?.fcmTokens?.length > 0) {
          const notification = {
            title: `New Reply on Ticket #${ticket.ticketId}`,
            body: `An admin has replied to your support ticket.`,
            data: { ticketId: ticket._id.toString() },
          };
          user.fcmTokens.forEach(tokenInfo => sendPushNotification(tokenInfo.token, notification));
        }
      }
    } else {
      // USER REPLIED: Notify Admin(s)
      const senderUser = await User.findById(req.user.id);
      const notification = {
        title: `New Reply on Ticket #${ticket.ticketId}`,
        body: `${senderUser.name} has replied to a support ticket.`,
        data: { ticketId: ticket._id.toString() },
      };

      if (ticket.assignedTo) {
        const assignedAdmin = await User.findById(ticket.assignedTo);
        if (assignedAdmin?.fcmTokens?.length > 0) {
          assignedAdmin.fcmTokens.forEach(tokenInfo => 
            sendPushNotification(tokenInfo.token, notification)
          );
        }
      } else {
        const admins = await User.find({ role: { $in: ["support", "supervisor", "super_admin"] } });
        admins.flatMap(admin => 
          admin.fcmTokens.map(tokenInfo => sendPushNotification(tokenInfo.token, notification)));
      }
    }
    // --- END NOTIFICATION LOGIC ---

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
    if (user && user.fcmTokens?.length > 0) {
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
 */
export const assignTicket = async (req, res) => {
  const { assigneeId } = req.body;

  if (!mongoose.Types.ObjectId.isValid(assigneeId)) {
    return res.status(400).json({ message: "Invalid assignee ID." });
  }

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

    if (ticket.assignedTo) {
      ticket.assignmentHistory.push({
        assignedBy: req.user.id,
        assignedTo: ticket.assignedTo,
        assignedAt: new Date(),
      });
    }

    ticket.assignedTo = assigneeId;
    ticket.assignmentHistory.push({
      assignedBy: req.user.id,
      assignedTo: assigneeId,
      assignedAt: new Date(),
    });

    const updatedTicket = await ticket.save();

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