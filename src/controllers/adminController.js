import User from "../models/User.js";
import Order from "../models/Order.js";
import Gig from "../models/Gig.js";
import Transaction from "../models/Transaction.js";
import Wallet from "../models/Wallet.js";
import Category from "../models/Category.js";
import SubCategory from "../models/SubCategory.js";
import { sendNotification } from "./notificationController.js";

class AdminController {
  static escapeRegex(value = "") {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // ===========================================================================
  // 1. DASHBOARD & STATS
  // ===========================================================================
  
  static async getDashboardStats(req, res) {
    try {
      const [
        totalUsers,
        pendingVerifications,
        totalGigs,
        pendingGigs,
        activeGigs,
        totalOrders,
        revenueData,
      ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ verificationStatus: "pending" }),
        Gig.countDocuments(),
        Gig.countDocuments({ status: "pending" }),
        Gig.countDocuments({ status: "active" }),
        Order.countDocuments(),
        Transaction.aggregate([
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]),
      ]);
      console.log(JSON.stringify({
        users: {
          total: totalUsers,
          pendingVerification: pendingVerifications,
        },
        gigs: {
          total: totalGigs,
          pendingApproval: pendingGigs,
          active: activeGigs,
        },
        financials: {
          totalOrders: totalOrders,
          totalRevenue: revenueData[0]?.total || 0,
        },
      }, null, 2));
      res.json({
        users: {
          total: totalUsers,
          pendingVerification: pendingVerifications,
        },
        gigs: {
          total: totalGigs,
          pendingApproval: pendingGigs,
          active: activeGigs,
        },
        financials: {
          totalOrders: totalOrders,
          totalRevenue: revenueData[0]?.total || 0,
        },
      });
    } catch (error) {
      console.error("Stats Error:", error);
      res.status(500).json({ error: "Server error", details: error.message });
    }
  }

  static async getActivityChartData(req, res) {
    try {
      // Get last 30 days of transaction data aggregated by date
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const activityData = await Transaction.aggregate([
        {
          $match: {
            createdAt: { $gte: thirtyDaysAgo }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
            },
            value: { $sum: "$amount" },
            count: { $sum: 1 }
          }
        },
        {
          $sort: { _id: 1 }
        }
      ]);

      // Format data for the chart
      const chartData = activityData.map(item => {
        const date = new Date(item._id);
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return {
          name: `${monthNames[date.getMonth()]} ${date.getDate()}`,
          value: Math.round(item.value),
          timestamp: item._id
        };
      });

      res.json({ chartData });
    } catch (error) {
      console.error("Activity Chart Error:", error);
      res.status(500).json({ error: "Server error", details: error.message });
    }
  }

  static async getRecentActions(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      // Fetch more items from each source to ensure we have enough for pagination
      const fetchLimit = Math.max(limit * 3, 30); // Fetch more to have a good pool

      // Fetch recent activities from different sources
      const [recentUsers, recentGigs, recentOrders] = await Promise.all([
        User.find({ role: { $in: ["buyer", "seller"] } })
          .sort({ createdAt: -1 })
          .limit(fetchLimit)
          .select("name createdAt verificationStatus"),
        Gig.find()
          .sort({ updatedAt: -1 })
          .limit(fetchLimit)
          .populate("sellerId", "name")
          .select("title status updatedAt sellerId"),
        Order.find({ status: "completed" })
          .sort({ updatedAt: -1 })
          .limit(fetchLimit)
          .populate("buyerId", "name")
          .select("status updatedAt buyerId")
      ]);

      // Build actions array
      const actions = [];

      // Add user registrations
      recentUsers.forEach(user => {
        actions.push({
          id: `user_${user._id}`,
          type: user.verificationStatus === "approved" ? "VERIFICATION_APPROVED" : "USER_REGISTERED",
          entityType: "user",
          entityId: user._id.toString(),
          message: user.verificationStatus === "approved" 
            ? `User ${user.name} verified profile`
            : `New user registration: ${user.name}`,
          timestamp: user.createdAt,
          userId: user._id.toString(),
          userName: user.name
        });
      });

      // Add gig updates
      recentGigs.forEach(gig => {
        let actionType = "MODERATION_ACTION";
        let message = `Gig "${gig.title}" updated`;
        
        if (gig.status === "active") {
          actionType = "GIG_APPROVED";
          message = `Gig "${gig.title}" approved`;
        } else if (gig.status === "rejected") {
          actionType = "GIG_REJECTED";
          message = `Gig "${gig.title}" rejected`;
        }

        actions.push({
          id: `gig_${gig._id}`,
          type: actionType,
          entityType: "gig",
          entityId: gig._id.toString(),
          message,
          timestamp: gig.updatedAt,
          userId: gig.sellerId?._id?.toString(),
          userName: gig.sellerId?.name
        });
      });

      // Add completed orders
      recentOrders.forEach(order => {
        actions.push({
          id: `order_${order._id}`,
          type: "ORDER_COMPLETED",
          entityType: "order",
          entityId: order._id.toString(),
          message: `Order completed by ${order.buyerId?.name || "User"}`,
          timestamp: order.updatedAt,
          userId: order.buyerId?._id?.toString(),
          userName: order.buyerId?.name
        });
      });

      // Sort by timestamp
      actions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      // Get total count before pagination
      const total = actions.length;
      
      // Apply pagination
      const paginatedActions = actions.slice(skip, skip + limit);

      res.json({ 
        actions: paginatedActions,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error("Recent Actions Error:", error);
      res.status(500).json({ error: "Server error", details: error.message });
    }
  }

  static async getQuickInsights(req, res) {
    try {
      // Calculate various insights
      const [
        roleStats,
        ticketStats,
        todayLogins
      ] = await Promise.all([
        // Most active role
        User.aggregate([
          { $match: { role: { $in: ["support", "supervisor", "super_admin"] } } },
          { $group: { _id: "$role", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 1 }
        ]),
        // Support ticket resolution time (using SupportTicket model)
        (async () => {
          try {
            const SupportTicket = (await import("../models/SupportTicket.js")).default;
            const resolvedTickets = await SupportTicket.find({ 
              status: { $in: ["resolved", "closed"] }
            }).select("createdAt updatedAt");

            if (resolvedTickets.length === 0) {
              return { avgHours: 0, count: 0 };
            }

            const totalHours = resolvedTickets.reduce((sum, ticket) => {
              const hours = (new Date(ticket.updatedAt) - new Date(ticket.createdAt)) / (1000 * 60 * 60);
              return sum + hours;
            }, 0);

            return {
              avgHours: totalHours / resolvedTickets.length,
              count: resolvedTickets.length
            };
          } catch (err) {
            console.log("SupportTicket model not available:", err.message);
            return { avgHours: 0, count: 0 };
          }
        })(),
        // Today's logins
        User.countDocuments({
          lastLogin: {
            $gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        })
      ]);

      const mostActiveRole = roleStats[0] || { _id: "Support Staff", count: 0 };
      const roleNameMap = {
        "support": "Support Staff",
        "supervisor": "Supervisor",
        "super_admin": "Super Admin"
      };

      const insights = {
        mostActiveRole: {
          role: roleNameMap[mostActiveRole._id] || mostActiveRole._id,
          count: mostActiveRole.count
        },
        avgResolutionTime: {
          hours: parseFloat(ticketStats.avgHours.toFixed(1)),
          formatted: `${ticketStats.avgHours.toFixed(1)} hrs`,
          ticketCount: ticketStats.count
        },
        totalLoginsToday: todayLogins
      };

      res.json({ insights });
    } catch (error) {
      console.error("Quick Insights Error:", error);
      res.status(500).json({ error: "Server error", details: error.message });
    }
  }

  // ===========================================================================
  // 2. USER MANAGEMENT
  // ===========================================================================

 static async verifyUser(req, res) {
  const { userId, status, reason } = req.body; 

  // Allow pending, approved, rejected
  const allowedStatuses = ["pending", "approved", "rejected"];

  if (!userId || !status || !allowedStatuses.includes(status)) {
    return res.status(400).json({ error: "Invalid status." });
  }

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found." });

    user.verificationStatus = status;
    user.isVerified = status === "approved";
    await user.save();

    await sendNotification(
      userId,
      "system",
      `Your identity verification has been ${status}. ${reason || ""}`.trim()
    );

    res.json({ message: `User set to ${status}.`, user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}


  static async suspendUser(req, res) {
    const { userId, suspend, reason, internalNote } = req.body;

    if (!userId || typeof suspend !== "boolean") {
      return res.status(400).json({ error: "userId and suspend boolean required." });
    }

    try {
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ error: "User not found." });

      if (["support", "supervisor", "super_admin"].includes(user.role)) {
        return res.status(403).json({ error: "Cannot suspend admins." });
      }

      if (suspend) {
        // Notify BEFORE saving so we can use the existing FCM tokens
        await sendNotification(
          userId,
          "system",
          `Your account has been suspended. Reason: ${reason || "No reason provided."}`
        );

        // Add to suspension history
        if (!user.suspensionHistory) {
          user.suspensionHistory = [];
        }

        user.suspensionHistory.push({
          reason: reason || "No reason provided",
          suspendedAt: new Date(),
          suspendedBy: req.user.id, // Current admin
          internalNote: internalNote,
        });

        // Update current suspension details
        user.suspensionDetails = {
          reason: reason || "No reason provided",
          suspendedAt: new Date(),
          suspendedBy: req.user.id,
          internalNote: internalNote,
        };

        // Clear tokens to effectively "log out" devices from push
        user.fcmTokens = [];
      } else {
        // Reinstatement - update last suspension history entry
        if (user.suspensionHistory && user.suspensionHistory.length > 0) {
          const lastSuspension =
            user.suspensionHistory[user.suspensionHistory.length - 1];
          lastSuspension.reinstatedAt = new Date();
          lastSuspension.reinstatedBy = req.user.id;
          lastSuspension.reinstatementReason = reason;

          // If a new internal note is provided for reinstatement, we can record it.
          // We could either overwrite or append, but let's store it if provided.
          if (internalNote) {
            lastSuspension.internalNote = lastSuspension.internalNote
              ? `${lastSuspension.internalNote} | Reinstatement Note: ${internalNote}`
              : `Reinstatement Note: ${internalNote}`;
          }
        }
        user.suspensionDetails = undefined;
      }

      user.isSuspended = suspend;
      await user.save();

      if (!suspend) {
        await sendNotification(
          userId,
          "system",
          `Your account has been reinstated.`
        );
      }

      res.json({ message: `User ${suspend ? "suspended and logged out of all devices" : "reinstated"}.` });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async deleteUser(req, res) {
    const { id } = req.params;

    try {
      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({ error: "User not found." });
      }

      if (["support", "supervisor", "super_admin"].includes(user.role)) {
        return res.status(403).json({ error: "Cannot delete an admin user." });
      }
      
      // Check for money in wallet
      const wallet = await Wallet.findOne({ userId: id });
      if (wallet && wallet.balance > 0) {
        return res.status(400).json({
          error: "User cannot be deleted.",
          reason: `User has a wallet balance of ${wallet.balance}. Please ensure the balance is zero before deletion.`,
        });
      }

      // Check for active Orders
      const activeOrders = await Order.countDocuments({
        $or: [{ buyerId: id }, { sellerId: id }],
        status: { $in: ["pending", "offer_pending", "accepted"] },
      });

      if (activeOrders > 0) {
        return res.status(400).json({
          error: "User cannot be deleted.",
          reason: `This user has ${activeOrders} in-progress order(s). Please resolve these before deletion.`,
        });
      }

      // If checks pass, deactivate user's gigs
      if (user.role === 'seller') {
        await Gig.updateMany({ sellerId: id }, { $set: { status: 'suspended' } });
      }

      // Soft-delete the user
      user.isSuspended = true;
      user.suspensionDetails = {
        reason: "Account permanently deactivated by administrator.",
        suspendedAt: new Date(),
      };
      
      // We do NOT anonymize email/phone to prevent the user from signing up again with the same credentials.
      user.fcmTokens = []; // Clear FCM tokens to stop notifications

      await user.save();

      res.status(200).json({ message: "User has been safely deactivated and their gigs have been suspended." });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ error: "An error occurred during user deletion.", details: error.message });
    }
  }

  static async getAllUsers(req, res) {
    try {
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const limit = Math.max(parseInt(req.query.limit, 10) || 20, 1);
      const skip = (page - 1) * limit;
      const search = (req.query.search || "").trim();
      const role = req.query.role;
      const status = req.query.status;
      const hasDocuments = req.query.hasDocuments === "true";
      const verificationStatus = req.query.verificationStatus;
      const verificationType = req.query.verificationType;

      const query = {
        role: { $in: ["buyer", "seller"] },
      };

      const roleMap = {
        Worker: "seller",
        Client: "buyer",
        worker: "seller",
        client: "buyer",
        seller: "seller",
        buyer: "buyer",
      };

      if (role && role !== "All") {
        const normalizedRole = roleMap[role] || role;
        if (["buyer", "seller"].includes(normalizedRole)) {
          query.role = normalizedRole;
        }
      }

      if (status && status !== "All Status") {
        if (status === "Suspended") {
          query.isSuspended = true;
        } else if (status === "Pending") {
          query.$or = [
            { verificationStatus: "pending" },
            { "verification.status": "pending" },
          ];
        } else if (status === "Active") {
          query.isSuspended = false;
          query.$nor = [
            { verificationStatus: "pending" },
            { "verification.status": "pending" },
          ];
        }
      }

      if (hasDocuments) {
        query.$and = [
          ...(query.$and || []),
          {
            $or: [
              { "identityDocuments.0": { $exists: true } },
              { "certificates.0": { $exists: true } },
              { "portfolioImages.0": { $exists: true } },
            ],
          },
        ];
      }

      if (verificationStatus && verificationStatus !== "all") {
        const normalizedVerificationStatus = verificationStatus.toLowerCase();

        if (normalizedVerificationStatus === "pending") {
          query.$and = [
            ...(query.$and || []),
            {
              $or: [
                { verificationStatus: "pending" },
                { "verification.status": "pending" },
              ],
            },
          ];
        } else if (["approved", "rejected", "none"].includes(normalizedVerificationStatus)) {
          query.$and = [
            ...(query.$and || []),
            { verificationStatus: normalizedVerificationStatus },
          ];
        }
      }

      if (verificationType && verificationType !== "all") {
        const normalizedType = verificationType.toLowerCase();
        const typeFilters = {
          identity_document: { "identityDocuments.0": { $exists: true } },
          professional_certificate: { "certificates.0": { $exists: true } },
          portfolio_images: { "portfolioImages.0": { $exists: true } },
          national_id: { identityDocuments: { $elemMatch: { documentType: "national_id" } } },
          passport: { identityDocuments: { $elemMatch: { documentType: "passport" } } },
          driving_license: {
            identityDocuments: {
              $elemMatch: { documentType: { $in: ["driving_license", "drivers_license"] } },
            },
          },
          identity_card: { identityDocuments: { $elemMatch: { documentType: "identity_card" } } },
          residence_permit: { identityDocuments: { $elemMatch: { documentType: "residence_permit" } } },
        };

        if (typeFilters[normalizedType]) {
          query.$and = [...(query.$and || []), typeFilters[normalizedType]];
        }
      }

      if (search) {
        const searchRegex = new RegExp(AdminController.escapeRegex(search), "i");
        const gigSearchPipeline = [
          {
            $addFields: {
              idAsString: { $toString: "$_id" },
            },
          },
          {
            $match: {
              $or: [{ title: { $regex: searchRegex } }, { idAsString: { $regex: searchRegex } }],
            },
          },
          {
            $project: { sellerId: 1 },
          },
          { $limit: 500 },
        ];

        const matchedGigs = await Gig.aggregate(gigSearchPipeline);
        const matchedSellerIds = matchedGigs.map((gig) => gig.sellerId).filter(Boolean);

        query.$and = [
          ...(query.$and || []),
          {
            $or: [
              { name: { $regex: searchRegex } },
              { email: { $regex: searchRegex } },
              { mobileNumber: { $regex: searchRegex } },
              { skills: { $regex: searchRegex } },
              ...(matchedSellerIds.length ? [{ _id: { $in: matchedSellerIds } }] : []),
            ],
          },
        ];
      }

      const users = await User.find(query)
        .select("-password -verificationCode")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await User.countDocuments(query);

      const summaryBaseQuery = { ...query };
      delete summaryBaseQuery.role;

      const verifiedFilter = {
        $or: [
          { isVerified: true },
          { verificationStatus: "approved" },
          { "verification.status": "verified" },
        ],
      };

      const [totalWorkers, totalClients, verifiedUsers] = await Promise.all([
        User.countDocuments({ ...summaryBaseQuery, role: "seller" }),
        User.countDocuments({ ...summaryBaseQuery, role: "buyer" }),
        User.countDocuments({
          ...summaryBaseQuery,
          $and: [...(summaryBaseQuery.$and || []), verifiedFilter],
        }),
      ]);

      const verificationSummaryBaseQuery = { ...summaryBaseQuery };
      delete verificationSummaryBaseQuery.$or;

      if (Array.isArray(verificationSummaryBaseQuery.$and)) {
        verificationSummaryBaseQuery.$and = verificationSummaryBaseQuery.$and.filter((condition) => {
          if (condition.verificationStatus) {
            return false;
          }

          if (Array.isArray(condition.$or)) {
            const isVerificationPendingCondition = condition.$or.some(
              (entry) =>
                entry.verificationStatus === "pending" ||
                Object.prototype.hasOwnProperty.call(entry, "verification.status"),
            );

            if (isVerificationPendingCondition) {
              return false;
            }
          }

          return true;
        });

        if (!verificationSummaryBaseQuery.$and.length) {
          delete verificationSummaryBaseQuery.$and;
        }
      }

      const [pendingVerification, approvedVerification, rejectedVerification, totalVerification] = await Promise.all([
        User.countDocuments({
          ...verificationSummaryBaseQuery,
          $and: [
            ...(verificationSummaryBaseQuery.$and || []),
            {
              $or: [
                { verificationStatus: "pending" },
                { "verification.status": "pending" },
              ],
            },
          ],
        }),
        User.countDocuments({
          ...verificationSummaryBaseQuery,
          $and: [...(verificationSummaryBaseQuery.$and || []), { verificationStatus: "approved" }],
        }),
        User.countDocuments({
          ...verificationSummaryBaseQuery,
          $and: [...(verificationSummaryBaseQuery.$and || []), { verificationStatus: "rejected" }],
        }),
        User.countDocuments(verificationSummaryBaseQuery),
      ]);

      res.json({
        users,
        summary: {
          workers: totalWorkers,
          clients: totalClients,
          verified: verifiedUsers,
        },
        verificationSummary: {
          pending: pendingVerification,
          approved: approvedVerification,
          rejected: rejectedVerification,
          total: totalVerification,
        },
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async viewUserActivity(req, res) {
    try {
      const { userId } = req.params;
      const user = await User.findById(userId).select("name email role createdAt");
      if (!user) return res.status(404).json({ error: "User not found." });

      const recentOrders = await Order.find({
        $or: [{ buyerId: userId }, { sellerId: userId }],
      }).sort({ createdAt: -1 }).limit(10);

      const recentTransactions = await Transaction.find({ userId }).sort({ createdAt: -1 }).limit(10);

      res.json({ user, recentOrders, recentTransactions });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // ===========================================================================
  // 3. ADMIN TEAM MANAGEMENT (Create Admins)
  // ===========================================================================

  static async createSubAdmin(req, res) {
    try {
      const { name, email, mobileNumber, password, role } = req.body;

      // Validate required fields
      if (!name || !email || !mobileNumber || !password || !role) {
        return res.status(400).json({ 
          error: "Missing required fields",
          message: "Please fill in all required fields: name, email, mobile number, password, and role." 
        });
      }

      const allowedRoles = ["support", "supervisor", "super_admin"];
      if (!allowedRoles.includes(role)) {
        return res.status(400).json({ 
          error: "Invalid admin role",
          message: `Please select a valid role: Support, Supervisor, or Super Admin.` 
        });
      }

      // Check for existing email
      const existingEmail = await User.findOne({ email });
      if (existingEmail) {
        return res.status(400).json({ 
          error: "Email already exists",
          message: `The email address "${email}" is already registered in the system. Please use a different email.` 
        });
      }

      // Check for existing mobile number
      const existingMobile = await User.findOne({ mobileNumber });
      if (existingMobile) {
        return res.status(400).json({ 
          error: "Mobile number already exists",
          message: `The mobile number "${mobileNumber}" is already registered. Please use a different number.` 
        });
      }

      const user = await User.create({
        name,
        email,
        mobileNumber,
        password, 
        role,
        isVerified: true
      });

      res.status(201).json({ 
        message: "Admin created successfully", 
        user: { 
          id: user._id,
          name: user.name,
          email: user.email, 
          role: user.role 
        } 
      });
    } catch (error) {
      console.error('Create admin error:', error);

      // Handle MongoDB duplicate key error
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        const value = error.keyValue[field];
        
        let friendlyField = field;
        if (field === 'mobileNumber') friendlyField = 'mobile number';
        
        return res.status(400).json({ 
          error: "Duplicate entry",
          message: `This ${friendlyField} (${value}) is already registered in the system. Please use a different ${friendlyField}.` 
        });
      }

      // Handle validation errors
      if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(err => err.message);
        return res.status(400).json({ 
          error: "Validation failed",
          message: messages.join('. ') 
        });
      }

      // Generic error
      res.status(500).json({ 
        error: "Server error",
        message: "An unexpected error occurred while creating the user. Please try again or contact support if the problem persists." 
      });
    }
  }

  static async forceResetPassword(req, res) {
    try {
      const { id } = req.params;
      const { newPassword } = req.body;

      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: "Password too short." });
      }

      const user = await User.findById(id);
      if (!user) return res.status(404).json({ error: "User not found" });

      user.password = newPassword;
      await user.save();

      res.json({ message: "Password reset successfully." });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // --- NEW: Get All Admins ---
  static async getAdmins(req, res) {
    try {
      const {
        role,
        status,
        search,
        sort = 'newest',
        page = 1,
        limit = 100
      } = req.query;

      // Build query
      const query = {
        role: { $in: ["support", "supervisor", "super_admin"] },
      };

      // Role filter
      if (role && role !== 'All Roles') {
        query.role = role;
      }

      // Status filter
      if (status && status !== 'All Status') {
        if (status === 'Active') {
          query.isSuspended = false;
        } else if (status === 'Inactive' || status === 'Suspended') {
          query.isSuspended = true;
        }
      }

      // Search filter
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ];
      }

      // Determine sort order
      let sortOption = {};
      switch (sort) {
        case 'oldest':
          sortOption = { createdAt: 1 };
          break;
        case 'name_asc':
          sortOption = { name: 1 };
          break;
        case 'name_desc':
          sortOption = { name: -1 };
          break;
        case 'newest':
        default:
          sortOption = { createdAt: -1 };
          break;
      }

      // Execute query with pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const admins = await User.find(query)
        .select("-password")
        .sort(sortOption)
        .skip(skip)
        .limit(parseInt(limit));

      // Get total count for pagination
      const total = await User.countDocuments(query);

      res.json({
        admins,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // --- NEW: Get Single Admin ---
  static async getAdminById(req, res) {
    try {
      const { id } = req.params;
      const admin = await User.findById(id).select("-password");

      if (!admin || !["support", "supervisor", "super_admin"].includes(admin.role)) {
        return res.status(404).json({ error: "Admin user not found" });
      }

      res.json(admin);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // --- NEW: Update Admin ---
  static async updateAdmin(req, res) {
    try {
      const { id } = req.params;
      const { name, role, isSuspended } = req.body;

      const allowedRoles = ["support", "supervisor", "super_admin"];
      if (role && !allowedRoles.includes(role)) {
        return res.status(400).json({ error: "Invalid role specified" });
      }

      const admin = await User.findById(id);
      if (!admin || !["support", "supervisor", "super_admin"].includes(admin.role)) {
        return res.status(404).json({ error: "Admin user not found" });
      }

      if (name) admin.name = name;
      if (role) admin.role = role;
      if (typeof isSuspended === "boolean") admin.isSuspended = isSuspended;

      await admin.save();
      res.json({ message: "Admin user updated successfully", user: admin });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // --- NEW: Delete Admin ---
  static async deleteAdmin(req, res) {
    try {
      const { id } = req.params;
      const admin = await User.findById(id);

      if (!admin || !["support", "supervisor", "super_admin"].includes(admin.role)) {
        return res.status(404).json({ error: "Admin user not found" });
      }

      // Soft delete or some other logic might be better here in a real app
      await User.findByIdAndDelete(id);

      res.status(200).json({ message: "Admin user deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }


  // ===========================================================================
  // 4. CATEGORY MANAGEMENT (Skills)
  // ===========================================================================

  static async createCategory(req, res) {
    try {
      const { name } = req.body;
      if (!name) return res.status(400).json({ error: "Name required" });

      const category = await Category.create({ name });
      res.status(201).json({ message: "Category created", category });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getCategories(req, res) {
    try {
      const categories = await Category.find().sort({ name: 1 });
      res.json(categories);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // --- NEW: Update Category ---
  static async updateCategory(req, res) {
    try {
      const { id } = req.params;
      const { name, isActive } = req.body;

      const category = await Category.findByIdAndUpdate(
        id, 
        { name, isActive }, 
        { new: true }
      );
      if(!category) return res.status(404).json({ error: "Category not found" });

      res.json({ message: "Category updated", category });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // --- NEW: Delete Category ---
  static async deleteCategory(req, res) {
    try {
      const { id } = req.params;
      
      const gigCount = await Gig.countDocuments({ category: id });
      if(gigCount > 0) {
        return res.status(400).json({ 
          error: `Cannot delete. ${gigCount} Gigs depend on this category. Deactivate it instead.` 
        });
      }

      const category = await Category.findByIdAndDelete(id);
      if(!category) return res.status(404).json({ error: "Category not found" });

      res.json({ message: "Category deleted" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // ===========================================================================
  // SUBCATEGORY MANAGEMENT
  // ===========================================================================

  static async createSubCategory(req, res) {
    try {
      const { name, categoryId } = req.body;
      if (!name || !categoryId) {
        return res.status(400).json({ error: "Name and categoryId are required" });
      }

      const parentCategory = await Category.findById(categoryId);
      if (!parentCategory) {
        return res.status(404).json({ error: "Parent category not found" });
      }

      const subCategory = await SubCategory.create({ name, categoryId });
      res.status(201).json({ message: "SubCategory created", subCategory });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getSubCategories(req, res) {
    try {
      const filter = {};
      if (req.query.categoryId) {
        filter.categoryId = req.query.categoryId;
      }
      const subCategories = await SubCategory.find(filter).populate('categoryId', 'name').sort({ name: 1 });
      res.json(subCategories);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async updateSubCategory(req, res) {
    try {
      const { id } = req.params;
      const { name, isActive } = req.body;

      const subCategory = await SubCategory.findByIdAndUpdate(id, { name, isActive }, { new: true });
      if (!subCategory) return res.status(404).json({ error: "SubCategory not found" });

      res.json({ message: "SubCategory updated", subCategory });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async deleteSubCategory(req, res) {
    // Note: Add logic here to check if any gigs are using this subcategory before deleting
    // For now, it's a direct delete.
    const subCategory = await SubCategory.findByIdAndDelete(req.params.id);
    if (!subCategory) return res.status(404).json({ error: "SubCategory not found" });
    res.json({ message: "SubCategory deleted" });
  }
  // ===========================================================================
  // 5. GIG MANAGEMENT
  // ===========================================================================

  static async getAllGigs(req, res) {
    try {
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const limit = Math.max(parseInt(req.query.limit, 10) || 10, 1);
      const skip = (page - 1) * limit;
      const search = (req.query.search || "").trim();
      const status = req.query.status;

      const baseFilter = {};

      if (search) {
        const searchRegex = new RegExp(AdminController.escapeRegex(search), "i");

        const [matchedSellers, matchedGigIdsById] = await Promise.all([
          User.find({ name: { $regex: searchRegex } }).select("_id"),
          Gig.aggregate([
            { $addFields: { idAsString: { $toString: "$_id" } } },
            { $match: { idAsString: { $regex: searchRegex } } },
            { $project: { _id: 1 } },
            { $limit: 500 },
          ]),
        ]);

        const matchedSellerIds = matchedSellers.map((seller) => seller._id);
        const matchedGigIds = matchedGigIdsById.map((gig) => gig._id);

        baseFilter.$or = [
          { title: { $regex: searchRegex } },
          ...(matchedSellerIds.length ? [{ sellerId: { $in: matchedSellerIds } }] : []),
          ...(matchedGigIds.length ? [{ _id: { $in: matchedGigIds } }] : []),
        ];
      }

      const filter = { ...baseFilter };
      if (status && status !== "All") {
        filter.status = status;
      }

      const gigs = await Gig.find(filter)
        .populate("sellerId", "name email rating mobileNumber address selectedAreas")
        .populate("category", "name")
        .populate("primarySubcategory", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await Gig.countDocuments(filter);

      const summaryBuckets = await Gig.aggregate([
        { $match: baseFilter },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]);

      const summary = summaryBuckets.reduce(
        (acc, item) => {
          if (item._id && Object.prototype.hasOwnProperty.call(acc, item._id)) {
            acc[item._id] = item.count;
          }
          acc.total += item.count;
          return acc;
        },
        {
          pending: 0,
          active: 0,
          rejected: 0,
          suspended: 0,
          total: 0,
        },
      );

      res.json({
        gigs,
        summary,
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getGigById(req, res) {
    try {
      const { id } = req.params;

      const gig = await Gig.findById(id)
        .populate("sellerId", "name email mobileNumber rating bio skills yearsOfExperience address selectedAreas profilePicture location isVerified verificationStatus isSuspended")
        .populate("category", "name")
        .populate("primarySubcategory", "name")
        .populate("extraSubcategories", "name");

      if (!gig) {
        return res.status(404).json({ error: "Gig not found" });
      }

      res.json({ gig });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async updateGigStatus(req, res) {
  const { id } = req.params;
  const { status, reason } = req.body;

  // Allow full status transitions
  const allowedStatuses = ["pending", "active", "rejected", "suspended"];

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ error: "Invalid status." });
  }

  try {
    const gig = await Gig.findById(id);
    if (!gig) return res.status(404).json({ error: "Gig not found" });

    // Update gig status
    gig.status = status;

    // Only store rejection reason when the status is "rejected"
    if (status === "rejected") {
      gig.rejectionReason = reason || "No reason provided";
    } else {
      gig.rejectionReason = undefined; // reset
    }

    await gig.save();

    // Notify seller
    await sendNotification(
      gig.sellerId,
      "system",
      `Your gig "${gig.title}" status changed to ${status}.`
    );

    res.json({ message: `Gig updated to ${status}`, gig });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}


  static async deleteGig(req, res) {
    try {
      const gig = await Gig.findByIdAndDelete(req.params.id);
      if (!gig) return res.status(404).json({ error: "Gig not found" });
      res.json({ message: "Gig deleted" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // ===========================================================================
  // 6. ORDER MANAGEMENT
  // ===========================================================================

  static async getAllOrders(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
      const filter = {};

      if (req.query.status) filter.status = req.query.status;
      if (req.query.orderId) filter._id = req.query.orderId;

      const orders = await Order.find(filter)
        .populate("buyerId", "name email")
        .populate("sellerId", "name email")
        .populate("gigId", "title")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await Order.countDocuments(filter);
      res.json({ orders, pagination: { total, page, limit, totalPages: Math.ceil(total/limit) } });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getOrderDetails(req, res) {
    try {
      const order = await Order.findById(req.params.id)
        .populate("buyerId", "name email mobileNumber")
        .populate("sellerId", "name email mobileNumber")
        .populate("gigId");

      if (!order) return res.status(404).json({ error: "Order not found" });

      res.json({ order });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async adminCancelOrder(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const order = await Order.findById(id);
      if (!order) return res.status(404).json({ error: "Order not found" });

      if (order.status === "cancelled" || order.status === "completed") {
        return res.status(400).json({ error: `Order is already ${order.status}` });
      }

      order.status = "cancelled";
      await order.save();

      await Promise.all([
        sendNotification(order.buyerId, "system", `Order #${id} cancelled by Admin. Reason: ${reason}`),
        sendNotification(order.sellerId, "system", `Order #${id} cancelled by Admin. Reason: ${reason}`),
      ]);

      res.json({ message: "Order cancelled successfully", order });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // ===========================================================================
  // 7. PLATFORM SETTINGS
  // ===========================================================================
  static async updatePlatformSettings(req, res) {
    res.status(501).json({ message: "Not implemented." });
  }

  static async viewFinancialLogs(req, res) {
    try {
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const limit = Math.max(parseInt(req.query.limit, 10) || 20, 1);
      const skip = (page - 1) * limit;
      const search = (req.query.search || "").trim();
      const type = req.query.type;
      const status = req.query.status;

      const query = {};

      if (type && type !== "All Types") {
        const normalizedType = type.toLowerCase();
        if (["deposit", "withdrawal", "refund"].includes(normalizedType)) {
          query.type = normalizedType;
        }
      }

      if (status && status !== "All Status") {
        const normalizedStatus = status.toLowerCase();
        if (["completed", "pending", "failed"].includes(normalizedStatus)) {
          query.status = normalizedStatus;
        }
      }

      if (search) {
        const searchRegex = new RegExp(search, "i");
        const matchedUsers = await User.find({
          $or: [
            { name: { $regex: searchRegex } },
            { email: { $regex: searchRegex } },
            { mobileNumber: { $regex: searchRegex } },
          ],
        }).select("_id");

        const matchedUserIds = matchedUsers.map((user) => user._id);

        query.$or = [
          { description: { $regex: searchRegex } },
          { paymentMethod: { $regex: searchRegex } },
          { currency: { $regex: searchRegex } },
          ...(matchedUserIds.length ? [{ userId: { $in: matchedUserIds } }] : []),
        ];
      }

      const transactions = await Transaction.find(query)
        .populate("userId", "name email mobileNumber")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await Transaction.countDocuments(query);

      const summaryAggregate = await Transaction.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            completedTransactions: {
              $sum: {
                $cond: [{ $eq: ["$status", "completed"] }, 1, 0],
              },
            },
            pendingEscrowBalance: {
              $sum: {
                $cond: [{ $eq: ["$status", "pending"] }, "$amount", 0],
              },
            },
          },
        },
      ]);

      const summary = summaryAggregate[0] || {
        completedTransactions: 0,
        pendingEscrowBalance: 0,
      };

      res.json({
        data: transactions,
        summary: {
          platformRevenue: 0,
          completedTransactions: summary.completedTransactions,
          pendingEscrowBalance: summary.pendingEscrowBalance,
        },
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

export default AdminController;