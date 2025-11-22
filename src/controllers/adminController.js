import User from '../models/User.js';
import Order from '../models/Order.js';
import Transaction from '../models/Transaction.js';
import { sendNotification } from './notificationController.js';

// Note: A PlatformSettings model would be needed for updatePlatformSettings

class AdminController {

  /**
   * @description Approve or reject a user's identity verification.
   * @route POST /api/admin/verify-user
   * @access Supervisor+
   */
  static async verifyUser(req, res) {
    const { userId, status, reason } = req.body; // status: 'approved' or 'rejected'

    if (!userId || !status || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'userId and a valid status (approved, rejected) are required.' });
    }

    try {
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ error: 'User not found.' });

      user.verificationStatus = status;
      user.isVerified = status === 'approved';
      await user.save();

      await sendNotification(
        userId,
        'system',
        `Your identity verification has been ${status}. ${reason || ''}`.trim(),
        null,
        null
      );

      res.json({ message: `User verification status set to ${status}.`, user: { _id: user._id, verificationStatus: user.verificationStatus, isVerified: user.isVerified } });
    } catch (error) {
      res.status(500).json({ error: 'Server error while verifying user.', details: error.message });
    }
  }

  /**
   * @description Suspend or unsuspend a user account.
   * @route POST /api/admin/suspend-user
   * @access Supervisor+
   */
  static async suspendUser(req, res) {
    const { userId, suspend, reason } = req.body; // suspend: boolean

    if (!userId || typeof suspend !== 'boolean') {
      return res.status(400).json({ error: 'userId and a boolean `suspend` status are required.' });
    }
    if (suspend && !reason) {
      return res.status(400).json({ error: 'A reason is required to suspend a user.' });
    }

    try {
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ error: 'User not found.' });

      // Prevent admins from suspending other admins
      if (user.role !== 'buyer' && user.role !== 'seller') {
        return res.status(403).json({ error: 'Cannot suspend an administrative user.' });
      }

      user.isSuspended = suspend;
      if (suspend) {
        user.suspensionDetails = { reason, suspendedAt: new Date() };
      } else {
        user.suspensionDetails = undefined;
      }
      await user.save();

      const action = suspend ? 'suspended' : 'reinstated';
      await sendNotification(userId, 'system', `Your account has been ${action}. Reason: ${reason || 'N/A'}`);

      res.json({ message: `User account has been successfully ${action}.` });
    } catch (error) {
      res.status(500).json({ error: 'Server error while suspending user.', details: error.message });
    }
  }

  /**
   * @description Update global platform settings.
   * @route POST /api/admin/settings
   * @access Super Admin
   */
  static async updatePlatformSettings(req, res) {
    // TODO: Implement logic for updating platform-wide settings (e.g., commission rates, feature flags).
    // This would typically involve a dedicated 'PlatformSettings' model.
    res.status(501).json({ message: 'updatePlatformSettings function not implemented. A new model is required.' });
  }

  /**
   * @description View financial transaction logs.
   * @route GET /api/admin/financial-logs
   * @access Super Admin
   */
  static async viewFinancialLogs(req, res) {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 20;
      const skip = (page - 1) * limit;

      const transactions = await Transaction.find()
        .populate('userId', 'name email mobileNumber')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await Transaction.countDocuments();

      res.json({ data: transactions, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });

    } catch (error) {
      res.status(500).json({ error: 'Server error while fetching financial logs.', details: error.message });
    }
  }

  /**
   * @description View a specific user's activity log.
   * @route GET /api/admin/user-activity/:userId
   * @access Support Agent+
   */
  static async viewUserActivity(req, res) {
    const { userId } = req.params;

    try {
      const user = await User.findById(userId).select('name email mobileNumber role createdAt');
      if (!user) return res.status(404).json({ error: 'User not found.' });

      const recentOrders = await Order.find({ $or: [{ buyerId: userId }, { sellerId: userId }] })
        .sort({ createdAt: -1 })
        .limit(10);

      const recentTransactions = await Transaction.find({ userId })
        .sort({ createdAt: -1 })
        .limit(10);

      res.json({ user, recentOrders, recentTransactions });

    } catch (error) {
      res.status(500).json({ error: 'Server error while fetching user activity.', details: error.message });
    }
  }

  /**
   * @description Get a list of all users for the admin panel.
   * @route GET /api/admin/users
   * @access Support Agent+
   */
  static async getAllUsers(req, res) {
    try {
      const users = await User.find().select('-password -verificationCode -fcmTokens').sort({ createdAt: -1 });
      res.json({
        message: 'Users retrieved successfully.',
        users: users
      });
    } catch (error) {
      res.status(500).json({ error: 'Server error while fetching all users.', details: error.message });
    }
  }
}

export default AdminController;