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
    const { status, reason, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    // Build Filter Query
    const query = {};
    if (status) query.status = status;
    if (reason) query.reason = reason;

    // Fetch reports with populated details
    const reports = await Report.find(query)
      .populate("reporterId", "name email mobileNumber profilePicture") // Who filed it?
      .populate("reportedUserId", "name email mobileNumber isSuspended") // Who is the bad actor?
      .populate("gigId", "title") // Related Gig
      .populate("resolvedBy", "name") // Admin who fixed it
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Report.countDocuments(query);

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
      .populate("resolvedBy", "name");

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
    const { status, adminNote } = req.body; 
    const adminId = req.user.id;

    // Validate Status
    const validStatuses = ["pending", "reviewed", "resolved", "dismissed"];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status provided" });
    }

    const report = await Report.findById(id);
    if (!report) return res.status(404).json({ error: "Report not found" });

    // Update Fields
    report.status = status;
    report.adminNote = adminNote || report.adminNote; // Optional note
    report.resolvedBy = adminId; // Mark which admin touched this
    
    if (status === "resolved" || status === "dismissed") {
      report.resolvedAt = new Date();
    }

    await report.save();

    // Notify the User who filed the report
    await sendNotification(
      report.reporterId,
      "system",
      `Your report (Reason: ${report.reason}) has been updated to: ${status.toUpperCase()}.`,
      report._id,
      "Report"
    );

    res.json({ 
      message: `Report marked as ${status}`, 
      report 
    });

  } catch (error) {
    res.status(500).json({ error: "Failed to update report", details: error.message });
  }
};