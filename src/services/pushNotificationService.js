// services/pushService.js
import admin from "./firebase.js";
import dotenv from "dotenv";
dotenv.config();

/**
 * Sends a push notification using Firebase Admin SDK
 * @param {string} token - recipient device FCM token
 * @param {string} title - notification title
 * @param {string} body - notification body
 * @param {object} [data] - optional custom payload
 */
export const sendPushNotification = async (token, title, body, data = {}) => {
  try {
    const message = {
      token,
      notification: {
        title,
        body,
      },
      data, // optional custom key-value data
    };

    const response = await admin.messaging().send(message);

    console.log("✅ Push notification sent:", response);
  } catch (error) {
    console.error("❌ Error sending FCM push:", error);
  }
};

export const sendTestNotification = async (fcmToken) => {
  try {
    const message = {
      token: fcmToken,
      notification: {
        title: "Test Notification",
        body: "Your FCM token is working!",
      },
      data: {
        exampleKey: "exampleValue",
      },
    };

    const response = await admin.messaging().send(message);
    console.log("Successfully sent message:", response);
  } catch (error) {
    console.error("Error sending message:", error);
  }
};
