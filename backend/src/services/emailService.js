import { emailConfig } from '../config/email.js';

const MAILJET_API_URL = 'https://api.mailjet.com/v3.1/send';

const getAuthHeader = () => {
  const { mailjetApiKey, mailjetApiSecret } = emailConfig;
  if (!mailjetApiKey || !mailjetApiSecret) return null;
  return 'Basic ' + Buffer.from(`${mailjetApiKey}:${mailjetApiSecret}`).toString('base64');
};

const stripHtml = (html) => {
  return String(html || '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

export const sendEmail = async ({ to, subject, html }) => {
  if (!to || !subject || !html) {
    console.error('sendEmail: missing required fields (to, subject, html).');
    return null;
  }

  const authHeader = getAuthHeader();
  if (!authHeader) {
    console.warn('sendEmail: MJ_API_KEY/MJ_API_SECRET not configured. Skipping.');
    return null;
  }

  const textPart = stripHtml(html);

  try {
    const response = await fetch(MAILJET_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({
        Messages: [
          {
            From: {
              Email: emailConfig.senderEmail,
              Name: emailConfig.senderName,
            },
            To: [
              {
                Email: to,
              },
            ],
            Subject: subject,
            TextPart: textPart,
            HTMLPart: html,
          },
        ],
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error(`sendEmail: Mailjet API error for ${to}:`, JSON.stringify(result));
      return null;
    }

    const messageId = result?.Messages?.[0]?.Status === 'success'
      ? result.Messages[0].To?.[0]?.MessageID
      : 'unknown';

    console.log(`sendEmail: sent to ${to} (Mailjet ID: ${messageId})`);
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
