import app from './app.js';
import nodemailer from 'nodemailer';
import { connectToDatabase, syncDatabase } from './config/database.js';
import { seedDatabase } from './config/seedData.js';
import { emailConfig } from './config/email.js';

const PORT = Number(globalThis.process?.env?.PORT) || 4000;

globalThis.process?.on?.('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});

globalThis.process?.on?.('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

let lastSideEffectRun = 0;
const SIDE_EFFECT_INTERVAL_MS = 60_000;

const startServer = async () => {
  try {
    await connectToDatabase();
    await import('./models/sql/associations.js');
    await syncDatabase();
    await seedDatabase();

    if (emailConfig.auth.user && emailConfig.auth.pass) {
      try {
        const transporter = nodemailer.createTransport({
          host: emailConfig.host,
          port: emailConfig.port,
          secure: emailConfig.secure,
          auth: emailConfig.auth,
        });
        await transporter.verify();
        console.log('SMTP connection verified successfully.');
      } catch (emailError) {
        console.warn('SMTP verification failed. Emails may not be sent.', emailError?.message || emailError);
      }
    } else {
      console.warn('Email not configured (EMAIL_USER/EMAIL_PASS missing). Email features disabled.');
    }

    const { requestManagementModel } = await import('./models/requestManagementModel.js');
    setInterval(() => {
      const now = Date.now();
      if (now - lastSideEffectRun < SIDE_EFFECT_INTERVAL_MS) return;
      lastSideEffectRun = now;
      requestManagementModel.runScheduledSideEffects()
        .catch((err) => {
          console.error('Scheduled side-effects error:', err);
        });
    }, SIDE_EFFECT_INTERVAL_MS);

    app.listen(PORT, () => {
      console.log(`API running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start API server:', error);
    globalThis.process?.exit(1);
  }
};

startServer();
