import 'dotenv/config';

const {
  EMAIL_USER = '',
  EMAIL_FROM = '',
  BREVO_API_KEY = '',
  FRONTEND_URL = '',
} = globalThis.process?.env ?? {};

export const emailConfig = {
  brevoApiKey: BREVO_API_KEY,
  senderEmail: EMAIL_USER,
  senderName: 'PINT',
  from: EMAIL_FROM || EMAIL_USER,
  frontendUrl: FRONTEND_URL || 'http://localhost:5173',
};
