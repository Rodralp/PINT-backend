import nodemailer from 'nodemailer';
import { emailConfig } from '../config/email.js';

let transporter = null;

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: emailConfig.host,
      port: emailConfig.port,
      secure: emailConfig.secure,
      auth: emailConfig.auth,
    });
  }
  return transporter;
};

export const sendEmail = async ({ to, subject, html }) => {
  if (!to || !subject || !html) {
    console.error('sendEmail: missing required fields (to, subject, html).');
    return null;
  }

  if (!emailConfig.auth.user || !emailConfig.auth.pass) {
    console.warn('sendEmail: SMTP not configured (EMAIL_USER+EMAIL_PASS missing). Skipping.');
    return null;
  }

  try {
    const info = await getTransporter().sendMail({
      from: emailConfig.from,
      to,
      subject,
      html,
    });
    console.log(`sendEmail: sent to ${to} via SMTP (${info.messageId})`);
    return info;
  } catch (error) {
    console.error(`sendEmail: SMTP failed for ${to}:`, error.message || error);
    return null;
  }
};
