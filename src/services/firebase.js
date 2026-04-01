import admin from "firebase-admin";
import fs from "fs";
import path from "path";

// If you have a service account JSON, download from Firebase Console
// https://console.firebase.google.com/project/YOUR_PROJECT_ID/settings/serviceaccounts


const loadServiceAccount = () => {
  // 1. Try environment variable (JSON string)
  if (process.env.FIREBASE_SERVICE_ACCOUNT && process.env.FIREBASE_SERVICE_ACCOUNT.trim() !== "{}") {
    try {
      console.log("✅ Reading Firebase Credentials from ENV");
      return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } catch (e) {
      console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT environment variable:", e.message);
    }
  }

  // 2. Try specific file path using absolute root resolution
  const configPath = path.resolve(process.cwd(), "serviceaccount.json");
  if (fs.existsSync(configPath)) {
    try {
      console.log(`✅ Loaded Firebase credentials from file: ${configPath}`);
      return JSON.parse(fs.readFileSync(configPath, "utf8"));
    } catch (e) {
      console.error(`Failed to read ${configPath}:`, e.message);
    }
  }

  console.warn(`❌ No Firebase service account credentials found (Checked Env and ${configPath}). Firebase Admin may not initialize correctly.`);
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
