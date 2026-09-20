import { initializeApp, cert } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let initialized = false;
let messaging = null;

export const initFirebase = () => {
  if (initialized) return messaging;

  try {
    // const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!serviceAccountPath) {
      console.warn(
        "⚠️  FIREBASE_SERVICE_ACCOUNT_PATH not set. Notifications disabled.",
      );
      return null;
    }

    const absolutePath = path.resolve(__dirname, "..", serviceAccountPath);

    if (!fs.existsSync(absolutePath)) {
      console.warn(
        `⚠️  Firebase service account file not found at: ${absolutePath}. Notifications disabled.`,
      );
      return null;
    }

    const serviceAccount = JSON.parse(fs.readFileSync(absolutePath, "utf8"));

    // ⭐ Modular API
    initializeApp({
      credential: cert(serviceAccount),
    });

    messaging = getMessaging();

    initialized = true;
    console.log("✅ Firebase Admin initialized");
    return messaging;
  } catch (err) {
    console.error("❌ Firebase init error:", err.message);
    return null;
  }
};

export const getFirebaseMessaging = () => {
  if (!initialized) initFirebase();
  return messaging;
};
