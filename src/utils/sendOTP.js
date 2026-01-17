const { sendEmail } = require("../services/notifications/email");

exports.sendOTPEmail = async (email, otp) => {
  const html = `
    <p>Your admin login verification code is:</p>
    <h2 style="letter-spacing:2px">${otp}</h2>
    <p>This code expires in 10 minutes.</p>
    <p>If you did not attempt to log in, ignore this email.</p>
  `;

  await sendEmail(
    email,
    "Your Admin Login OTP",
    html
  );
};
