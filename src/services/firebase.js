import admin from "firebase-admin";
import fs from "fs";

// If you have a service account JSON, download from Firebase Console
// https://console.firebase.google.com/project/YOUR_PROJECT_ID/settings/serviceaccounts

const serviceAccount = JSON.parse(
  fs.readFileSync("./serviceaccount.json", "utf8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

export default admin;
