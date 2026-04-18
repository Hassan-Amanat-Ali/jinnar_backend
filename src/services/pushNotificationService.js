// services/pushService.js
import admin from "./firebase.js";
import dotenv from "dotenv";
dotenv.config();

/**
 * Sends a push notification using Firebase Admin SDK to one or more devices.
 * @param {string|string[]} tokens - recipient device FCM token(s)
 * @param {string} title - notification title
 * @param {string} body - notification body
 * @param {object} [data] - optional custom payload
 */
export const sendPushNotification = async (tokens, title, body, data = {}) => {
  try {
    const stringData = {};
    Object.keys(data).forEach(key => {
      stringData[key] = data[key] === null ? "" : String(data[key]);
    });

    const tokenArray = Array.isArray(tokens) ? tokens : [tokens];
    const validTokens = tokenArray.filter(t => !!t);

    if (validTokens.length === 0) return;

    const message = {
      tokens: validTokens,
      notification: { title, body },
      data: stringData,
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`✅ Push notification sent. Successes: ${response.successCount}, Failures: ${response.failureCount}`);

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
