import Notification from '../models/Notification.js';

/**
 * Create a new notification
 * (Used internally when you want to send a notification to another user)
 */
export const sendNotification = async (recipientId, type, content, relatedId = null, relatedModel = null) => {
  try {
    await Notification.create({
      recipientId,
      type,
      content,
      relatedId,
      relatedModel,
    });
  } catch (error) {
    console.error('Error sending notification:', error);
  }
};

/**
 * Get all notifications for the authenticated user
 */
export const getNotifications = async (req, res) => {
  try {
    const { id } = req.user; // from JWT middleware

    const notifications = await Notification.find({ recipientId: id })
      .sort({ createdAt: -1 })
      .limit(100); // add pagination later if needed

    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Mark one or all notifications as read for the authenticated user
 */
export const markAsRead = async (req, res) => {
  const { id } = req.user; // from JWT middleware
  const { notificationId } = req.body;

  try {
    if (notificationId) {
      // Mark a specific notification
      const notif = await Notification.findOneAndUpdate(
        { _id: notificationId, recipientId: id },
        { isRead: true },
        { new: true }
      );

      if (!notif) {
        return res.status(404).json({ message: 'Notification not found or not yours' });
      }
    } else {
      // Mark all as read for this user
      await Notification.updateMany({ recipientId: id }, { isRead: true });
    }

    res.json({ message: 'Notification(s) marked as read' });
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
