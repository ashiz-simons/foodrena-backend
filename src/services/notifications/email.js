const sgMail = require('@sendgrid/mail');
const config = require('../../config');

const SENDGRID_KEY = config.sendgrid;

if (SENDGRID_KEY && SENDGRID_KEY.startsWith('SG.')) {
  sgMail.setApiKey(SENDGRID_KEY);
  console.log('📧 SendGrid enabled');
} else {
  console.warn('⚠️ SendGrid disabled (no valid API key)');
}

async function sendEmail(to, subject, html) {
  if (!SENDGRID_KEY || !SENDGRID_KEY.startsWith('SG.')) {
    // silently skip in dev
    return;
  }

  return sgMail.send({
    to,
    from: process.env.FROM_EMAIL || 'no-reply@foodrena.dev',
    subject,
    html,
  });
}

module.exports = { sendEmail };
