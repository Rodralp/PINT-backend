import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import { emailConfig } from '../config/email.js';

let resendClient = null;
let transporter = null;

const getResendClient = () => {
  if (!resendClient && emailConfig.resendApiKey) {
    resendClient = new Resend(emailConfig.resendApiKey);
  }
  return resendClient;
};

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

  const resend = getResendClient();
  if (resend) {
    try {
      const { data, error } = await resend.emails.send({
        from: emailConfig.resendFrom || 'PINT <onboarding@resend.dev>',
        to,
        subject,
        html,
      });
      if (error) {
        console.error('sendEmail (Resend) error:', error);
        return null;
      }
      return data;
    } catch (error) {
      console.error('sendEmail (Resend) failed:', error);
      return null;
    }
  }

  if (!emailConfig.auth.user || !emailConfig.auth.pass) {
    console.warn('sendEmail: email not configured (RESEND_API_KEY / EMAIL_USER+EMAIL_PASS missing). Skipping.');
    return null;
  }

  try {
    const info = await getTransporter().sendMail({
      from: emailConfig.from,
      to,
      subject,
      html,
    });
    return info;
  } catch (error) {
    console.error('sendEmail (SMTP) failed:', error);
    return null;
  }
};
