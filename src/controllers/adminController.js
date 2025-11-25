import User from "../models/User.js";
import Order from "../models/Order.js";
import Gig from "../models/Gig.js";
import Transaction from "../models/Transaction.js";
import Category from "../models/Category.js";
import { sendNotification } from "./notificationController.js";

class AdminController {
  
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
    const { userId, suspend, reason } = req.body;

    if (!userId || typeof suspend !== "boolean") {
      return res.status(400).json({ error: "userId and suspend boolean required." });
    }

    try {
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ error: "User not found." });

      if (["support", "supervisor", "super_admin"].includes(user.role)) {
        return res.status(403).json({ error: "Cannot suspend admins." });
      }

      user.isSuspended = suspend;
      user.suspensionDetails = suspend ? { reason, suspendedAt: new Date() } : undefined;
      await user.save();

      await sendNotification(
        userId,
        "system",
        `Your account has been ${suspend ? "suspended" : "reinstated"}.`
      );

      res.json({ message: `User ${suspend ? "suspended" : "reinstated"}.` });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getAllUsers(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;
      const search = req.query.search || "";

      const query = search
        ? {
            $or: [
              { name: { $regex: search, $options: "i" } },
              { email: { $regex: search, $options: "i" } },
            ],
          }
        : {};

      const users = await User.find(query)
        .select("-password -verificationCode")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await User.countDocuments(query);

      res.json({ users, pagination: { total, page, limit, totalPages: Math.ceil(total/limit) } });
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

      const allowedRoles = ["support", "supervisor", "regional_manager"];
      if (!allowedRoles.includes(role)) {
        return res.status(400).json({ error: "Invalid admin role." });
      }

      const existing = await User.findOne({ email });
      if (existing) return res.status(400).json({ error: "Email already exists." });

      const user = await User.create({
        name,
        email,
        mobileNumber,
        password, 
        role,
        isVerified: true
      });

      res.status(201).json({ message: "Admin created", user: { email: user.email, role: user.role } });
    } catch (error) {
      res.status(500).json({ error: error.message });
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
      const admins = await User.find({
        role: { $in: ["support", "supervisor", "super_admin"] },
      }).select("-password");
      res.json(admins);
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
      const { name, icon } = req.body;
      if (!name) return res.status(400).json({ error: "Name required" });

      const category = await Category.create({ name, icon });
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
      const { name, icon, isActive } = req.body;

      const category = await Category.findByIdAndUpdate(
        id, 
        { name, icon, isActive }, 
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
  // 5. GIG MANAGEMENT
  // ===========================================================================

  static async getAllGigs(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
      const filter = {};

      if (req.query.status) filter.status = req.query.status;
      if (req.query.search) filter.title = { $regex: req.query.search, $options: "i" };

      const gigs = await Gig.find(filter)
        .populate("sellerId", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await Gig.countDocuments(filter);

      res.json({ gigs, pagination: { total, page, limit, totalPages: Math.ceil(total/limit) } });
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
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;

      const transactions = await Transaction.find()
        .populate("userId", "name email mobileNumber")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await Transaction.countDocuments();
      res.json({ data: transactions, pagination: { total, page, limit, totalPages: Math.ceil(total/limit) } });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

export default AdminController;