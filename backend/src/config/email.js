import 'dotenv/config';

const {
  EMAIL_HOST = 'smtp.gmail.com',
  EMAIL_PORT = '587',
  EMAIL_USER = '',
  EMAIL_PASS = '',
  EMAIL_FROM = '',
  RESEND_API_KEY = '',
  RESEND_FROM = '',
} = globalThis.process?.env ?? {};

export const emailConfig = {
  host: EMAIL_HOST,
  port: Number(EMAIL_PORT),
  secure: Number(EMAIL_PORT) === 465,
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
  from: EMAIL_FROM || EMAIL_USER,
  resendApiKey: RESEND_API_KEY,
  resendFrom: RESEND_FROM,
};
