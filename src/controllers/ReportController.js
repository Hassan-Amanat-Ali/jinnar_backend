import Report from "../models/Report.js";
import { sendNotification } from "./notificationController.js"; // Ensure this path matches your file structure

// ───────────────────────────────────────
// USER FUNCTIONS (Public/Protected)
// ───────────────────────────────────────

/**
 * @description Create a new Report
 * @route POST /api/reports
 * @access Protected (Any User)
 */
export const createReport = async (req, res) => {
  try {
    const {
      reportedUserId, // ID of the user being reported (optional)
      gigId,          // ID of the Gig (optional)
      orderId,        // ID of the Order (optional)
      reason,         // Enum: "Spam", "Scam", etc.
      description,    // Text details
      attachments,    // Array of image URLs
    } = req.body;

    const reporterId = req.user.id; // From auth middleware

    // 1. Validation: Must report *something*
    if (!reportedUserId && !gigId && !orderId) {
      return res.status(400).json({
        error: "You must specify what you are reporting (User, Gig, or Order).",
      });
    }

    // 2. Create Report
    const report = await Report.create({
      reporterId,
      reportedUserId: reportedUserId || null,
      gigId: gigId || null,
      orderId: orderId || null,
      reason,
      description,
      attachments: attachments || [],
      status: "pending"
    });

    // 3. Optional: Notify Admins (Log or Email)
    // console.log(`New Report created by ${reporterId}`);

    res.status(201).json({
      success: true,
      message: "Report submitted successfully. Our support team will review it.",
      report,
    });
  } catch (error) {
    console.error("Create Report Error:", error);
    res.status(500).json({ error: "Failed to submit report", details: error.message });
  }
};

/**
 * @description Get reports filed BY the current user
 * @route GET /api/reports/me
 * @access Protected (Any User)
 */
export const getMyReports = async (req, res) => {
  try {
    const reports = await Report.find({ reporterId: req.user.id })
      .sort({ createdAt: -1 }); // Newest first
    res.json({ reports });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch reports", details: error.message });
  }
};


// ───────────────────────────────────────
// ADMIN FUNCTIONS (Protected + Authorized)
// ───────────────────────────────────────

/**
 * @description Get All Reports (with Filters & Pagination)
 * @route GET /api/admin/reports
 * @access Support Agent +
 */
export const getAllReports = async (req, res) => {
  try {
    const { status, reason, page = 1, limit = 10, search } = req.query;
    const skip = (page - 1) * limit;

    // Build Filter Query
    const query = {};
    if (status) query.status = status;
    if (reason) query.reason = reason;

    // If search is provided, we need to search by reporter or reported user names
    let finalQuery = query;

    if (search && search.trim()) {
      const User = (await import("../models/User.js")).default;

      // Search for users matching the search term
      const searchRegex = new RegExp(search.trim(), 'i');
      const matchingUsers = await User.find({
        $or: [
          { name: searchRegex },
          { email: searchRegex },
          { mobileNumber: searchRegex }
        ]
      }).select('_id');

      const userIds = matchingUsers.map(u => u._id);

      // Add user search to query
      finalQuery = {
        ...query,
        $or: [
          { reporterId: { $in: userIds } },
          { reportedUserId: { $in: userIds } }
        ]
      };
    }

    // Fetch reports with populated details
    const reports = await Report.find(finalQuery)
      .populate("reporterId", "name email mobileNumber profilePicture") // Who filed it?
      .populate("reportedUserId", "name email mobileNumber isSuspended") // Who is the bad actor?
      .populate("gigId", "title") // Related Gig
      .populate("resolvedBy", "name") // Admin who fixed it
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Report.countDocuments(finalQuery);

    res.json({
      reports,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch reports", details: error.message });
  }
};

/**
 * @description Get Single Report Details
 * @route GET /api/admin/reports/:id
 * @access Support Agent +
 */
export const getReportDetails = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id)
      .populate("reporterId", "name email mobileNumber")
      .populate("reportedUserId", "name email mobileNumber isSuspended")
      .populate("gigId", "title status")
      .populate("orderId")
      .populate("resolvedBy", "name")
      .populate("internalNotes.addedBy", "name role");

    if (!report) return res.status(404).json({ error: "Report not found" });

    res.json({ report });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch report details", details: error.message });
  }
};

/**
 * @description Update Report Status (Resolve/Dismiss)
 * @route PATCH /api/admin/reports/:id
 * @access Supervisor +
 */
export const updateReportStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNote, action } = req.body;
    const adminId = req.user.id;

    // Validate Status
    const validStatuses = ["pending", "reviewed", "resolved", "dismissed"];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status provided" });
    }

    const report = await Report.findById(id)
      .populate("reporterId", "name email mobileNumber")
      .populate("reportedUserId", "name email mobileNumber");

    if (!report) return res.status(404).json({ error: "Report not found" });

    // Update Report Fields
    report.status = status;
    report.resolvedBy = adminId;

    if (status === "resolved" || status === "dismissed") {
      report.resolvedAt = new Date();
    }

    // Add internal note if provided
    if (adminNote && adminNote.trim()) {
      report.internalNotes.push({
        note: adminNote,
        addedBy: adminId,
        addedAt: new Date(),
      });
      report.adminNote = adminNote; // Keep the latest note as main admin note
    }

    // Handle different actions
    let actionMessage = "";

    if (action === "suspend" && report.reportedUserId && report.reportedUserId._id) {
      // Suspend the reported user
      const User = (await import("../models/User.js")).default;
      const reportedUser = await User.findById(report.reportedUserId._id);

      if (!reportedUser) {
        return res.status(404).json({ error: "Reported user not found" });
      }

      if (["support", "supervisor", "super_admin"].includes(reportedUser.role)) {
        return res.status(403).json({ error: "Cannot suspend admin users" });
      }

      if (!reportedUser.isSuspended) {
        // Notify before suspending
        await sendNotification(
          reportedUser._id,
          "system",
          `Your account has been suspended due to: ${report.reason}. ${adminNote ? `Admin Note: ${adminNote}` : ""}`
        );

        // Add to suspension history
        if (!reportedUser.suspensionHistory) {
          reportedUser.suspensionHistory = [];
        }

        reportedUser.suspensionHistory.push({
          reason: report.reason,
          suspendedAt: new Date(),
          suspendedBy: adminId,
          relatedReport: report._id,
          internalNote: adminNote || "",
        });

        // Update current suspension details
        reportedUser.isSuspended = true;
        reportedUser.suspensionDetails = {
          reason: report.reason,
          suspendedAt: new Date(),
          suspendedBy: adminId,
          relatedReport: report._id,
          internalNote: adminNote || "",
        };

        // Clear FCM tokens to log out user
        reportedUser.fcmTokens = [];

        await reportedUser.save();

        report.actionTaken = "suspended";
        actionMessage = " and user has been suspended";
      } else {
        actionMessage = " (user was already suspended)";
      }

    } else if (action === "warn" && report.reportedUserId && report.reportedUserId._id) {
      // Send warning notification to the user
      await sendNotification(
        report.reportedUserId._id,
        "system",
        `Warning: Your recent activity has been flagged. Reason: ${report.reason}. Please review our community guidelines. ${adminNote ? `Note: ${adminNote}` : ""}`
      );

      report.actionTaken = "warned";
      actionMessage = " and warning has been sent to user";

    } else if (action === "dismiss") {
      report.actionTaken = "dismissed";
      actionMessage = "";
    } else {
      report.actionTaken = status === "resolved" ? "resolved" : "none";
    }

    await report.save();

    // Notify the reporter (person who filed the report)
    if (report.reporterId && report.reporterId._id) {
      await sendNotification(
        report.reporterId._id,
        "system",
        `Your report (Reason: ${report.reason}) has been ${status.toUpperCase()}. Thank you for helping keep our community safe.`,
        report._id,
        "Report"
      );
    }

    res.json({ 
      message: `Report marked as ${status}${actionMessage}`,
      report
    });

  } catch (error) {
    console.error("Update Report Error:", error);
    res.status(500).json({ error: "Failed to update report", details: error.message });
  }
};