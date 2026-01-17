const admin = require('firebase-admin');
const config = require('../../config');
if (config.fcmKeyPath) {
  try {
    const serviceAccount = require(config.fcmKeyPath);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } catch (err) {
    console.warn('FCM init failed', err.message);
  }
}

async function sendPush(token, payload) {
  if (!admin.apps.length) throw new Error('FCM not configured');
  return admin.messaging().sendToDevice(token, { data: payload });
}

module.exports = { sendPush };
