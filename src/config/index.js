require('dotenv').config();

module.exports = {
  port: process.env.PORT || 4000,
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || null,
    tls: process.env.REDIS_TLS === 'true',  // ✅ added
  },

  s3: {
    bucket: process.env.S3_BUCKET,
    region: process.env.S3_REGION,
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
  },

  stripe: {
    secret: process.env.STRIPE_SECRET
  },

  paystack: {
    secret: process.env.PAYSTACK_SECRET_KEY,  // ✅ fixed: was PAYSTACK_SECRET, env has PAYSTACK_SECRET_KEY
  },

  sendgrid: process.env.SENDGRID_API_KEY,
  fcmKeyPath: process.env.FCM_SERVICE_ACCOUNT_JSON_PATH
};