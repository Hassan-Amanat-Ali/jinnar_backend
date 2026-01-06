import admin from "firebase-admin";
import fs from "fs";

// If you have a service account JSON, download from Firebase Console
// https://console.firebase.google.com/project/YOUR_PROJECT_ID/settings/serviceaccounts


const loadServiceAccount = () => {
  // 1. Try environment variable (JSON string)
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } catch (e) {
      console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT environment variable:", e.message);
    }
  }

  // 2. Try specific file path
  if (fs.existsSync("./serviceaccount.json")) {
    try {
      return JSON.parse(fs.readFileSync("./serviceaccount.json", "utf8"));
    } catch (e) {
      console.error("Failed to read serviceaccount.json:", e.message);
    }
  }

  console.warn("No Firebase service account credentials found (Env: FIREBASE_SERVICE_ACCOUNT or file: serviceaccount.json). Firebase Admin may not initialize correctly.");
  return null;
};

const serviceAccount = loadServiceAccount();

if (serviceAccount) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} else {
  // Fallback for default Google Cloud environment (e.g. if deployed on GCP)
  admin.initializeApp();
}


export default admin;
