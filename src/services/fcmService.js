const admin = require("firebase-admin");

// Initialize Firebase Admin SDK once
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

/**
 * Send a push notification to a single FCM token
 */
async function sendNotification(token, { title, body, data = {} }) {
  if (!token) return;

  try {
    await admin.messaging().send({
      token,
      notification: { title, body },
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
      android: {
        priority: "high",
        notification: { sound: "default", channelId: "foodrena_default" },
      },
      apns: {
        payload: { aps: { sound: "default", badge: 1 } },
      },
    });
    console.log(`🔔 Notification sent: ${title}`);
  } catch (err) {
    // Token expired/invalid — clean it up
    if (
      err.code === "messaging/registration-token-not-registered" ||
      err.code === "messaging/invalid-registration-token"
    ) {
      console.warn(`⚠️ Invalid FCM token — skipping`);
      const User = require("../models/User");
      await User.findOneAndUpdate({ fcmToken: token }, { $unset: { fcmToken: "" } });
    } else {
      console.error("❌ FCM error:", err.message);
    }
  }
}

/**
 * Send to multiple tokens (e.g. all admins)
 */
async function sendToMany(tokens, payload) {
  const valid = tokens.filter(Boolean);
  if (!valid.length) return;
  await Promise.allSettled(valid.map((t) => sendNotification(t, payload)));
}

module.exports = { sendNotification, sendToMany };