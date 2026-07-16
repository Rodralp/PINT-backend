import { emailConfig } from '../config/email.js';

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

export const sendEmail = async ({ to, subject, html }) => {
  if (!to || !subject || !html) {
    console.error('sendEmail: missing required fields (to, subject, html).');
    return null;
  }

  const apiKey = emailConfig.brevoApiKey;
  const senderEmail = emailConfig.senderEmail;

  if (!apiKey || !senderEmail) {
    console.warn('sendEmail: BREVO_API_KEY or EMAIL_USER not configured. Skipping.');
    return null;
  }

  try {
    const response = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        sender: { name: emailConfig.senderName, email: senderEmail },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error(`sendEmail: Brevo API error for ${to}:`, JSON.stringify(result));
      return null;
    }

    console.log(`sendEmail: sent to ${to} (${result.messageId})`);
    return result;
  } catch (error) {
    console.error(`sendEmail: failed for ${to}:`, error.message || error);
    return null;
  }
};

export const sendEmailAsync = ({ to, subject, html }) => {
  sendEmail({ to, subject, html }).catch((err) => {
    console.error('sendEmailAsync: unhandled error:', err);
  });
};
