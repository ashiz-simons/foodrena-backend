const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const securityQuestionSchema = new mongoose.Schema({
  question: { type: String, required: true },
  answerHash: { type: String, required: true },
});

const userSchema = new mongoose.Schema(
  {
    name: String,

    email: {
      type: String,
      unique: true,
      lowercase: true,
      required: true,
    },

    password: {
      type: String,
      required: true,
      select: false,
    },

    role: {
      type: String,
      enum: ["user", "customer","rider", "vendor", "admin"],
      default: "customer",
    },
    
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [lng, lat]
        index: '2dsphere',
      },
    },
    
    emailVerified: {
      type: Boolean,
      default: false,
    },

    // 🔐 Admin security
    twoFactorEnabled: {
      type: Boolean,
      default: true,
    },

    securityQuestions: [securityQuestionSchema],

    // OTP for login / password reset
    otp: {
      codeHash: String,
      expiresAt: Date,
    },

    // Password reset token (issued AFTER OTP + security questions)
    resetToken: String,
    resetTokenExpires: Date,
  },
  { timestamps: true }
);

/* Hash password */
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.matchPassword = function (password) {
  return bcrypt.compare(password, this.password);
};

module.exports = mongoose.model("User", userSchema);
