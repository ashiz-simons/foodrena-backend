const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const securityQuestionSchema = new mongoose.Schema({
  question: { type: String, required: true },
  answerHash: { type: String, required: true },
});

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },

    email: {
      type: String,
      unique: true,
      lowercase: true,
      required: true,
    },

    phone: {
      type: String,
      required: true,
    },

    password: {
      type: String,
      required: true,
      select: false,
    },

    role: {
      type: String,
      enum: ["customer", "rider", "vendor", "admin"],
      default: "customer",
    },

    location: {
      type: {
        type: String,
        enum: ["Point"],
        required: true,
        default: "Point",
      },
      coordinates: {
        type: [Number], // [lng, lat]
        required: true,
      },
    },

    emailVerified: {
      type: Boolean,
      default: false,
    },

    twoFactorEnabled: {
      type: Boolean,
      default: true,
    },

    securityQuestions: [securityQuestionSchema],

    otp: {
      codeHash: String,
      expiresAt: Date,
    },

    resetToken: String,
    resetTokenExpires: Date,

    // ✅ FCM push notification token — saved by Flutter after login
    fcmToken: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

userSchema.index({ location: "2dsphere" });

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.matchPassword = function (password) {
  return bcrypt.compare(password, this.password);
};

module.exports = mongoose.model("User", userSchema);