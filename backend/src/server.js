import app from './app.js';
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

    // Ensure notification event defaults exist in config_notificacao
    try {
      const { adminGeneralManagementModel } = await import('./models/adminGeneralManagementModel.js');
      await adminGeneralManagementModel.ensureNotificationDefaults();
    } catch (notifError) {
      console.error('Failed to ensure notification defaults:', notifError);
    }

    if (emailConfig.mailjetApiKey && emailConfig.mailjetApiSecret && emailConfig.senderEmail) {
      console.log(`Email configured: Mailjet API ready (sender: ${emailConfig.senderEmail}).`);
    } else {
      console.warn('Email not configured (MJ_API_KEY/MJ_API_SECRET/MJ_SENDER_EMAIL missing). Email features disabled.');
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
