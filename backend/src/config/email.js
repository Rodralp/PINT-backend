import 'dotenv/config';

const {
  MJ_API_KEY = '',
  MJ_API_SECRET = '',
  MJ_SENDER_EMAIL = '',
  FRONTEND_URL = '',
} = globalThis.process?.env ?? {};

export const emailConfig = {
  mailjetApiKey: MJ_API_KEY,
  mailjetApiSecret: MJ_API_SECRET,
  senderEmail: MJ_SENDER_EMAIL,
  senderName: 'PINT',
  frontendUrl: FRONTEND_URL || 'http://localhost:5173',
};
