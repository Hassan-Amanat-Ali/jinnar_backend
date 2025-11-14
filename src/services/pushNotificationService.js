// services/pushService.js
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const FCM_URL = 'https://fcm.googleapis.com/fcm/send';
const FCM_API_KEY = process.env.FCM_API_KEY;

/**
 * Sends a push notification using Firebase Cloud Messaging
 * @param {string} token - recipient device FCM token
 * @param {string} title - notification title
 * @param {string} body - notification body text
 * @param {object} [data] - optional custom payload
 */
export const sendPushNotification = async (token, title, body, data = {}) => {
  try {
    const payload = {
      to: token,
      notification: {
        title,
        body,
      },
      data,
    };

    await axios.post(FCM_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `key=${FCM_API_KEY}`,
      },
    });

    console.log('✅ Push notification sent:', title);
  } catch (error) {
    console.error('❌ Error sending FCM push:', error.response?.data || error.message);
  }
};
