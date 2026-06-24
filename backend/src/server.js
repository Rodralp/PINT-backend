import app from './app.js';
import { connectToDatabase, syncDatabase, setupExtraTables } from './config/database.js';
import { applySchema } from './config/schema.js';
import { seedDatabase } from './config/seedData.js';

const PORT = Number(globalThis.process?.env?.PORT) || 4000;

let lastSideEffectRun = 0;
const SIDE_EFFECT_INTERVAL_MS = 60_000;

const startServer = async () => {
  try {
    await connectToDatabase();
    await applySchema();
    await setupExtraTables();
    await syncDatabase();
    await seedDatabase();

    const { requestManagementModel } = await import('./models/requestManagementModel.js');
    setInterval(async () => {
      const now = Date.now();
      if (now - lastSideEffectRun < SIDE_EFFECT_INTERVAL_MS) return;
      lastSideEffectRun = now;
      try {
        await requestManagementModel.runScheduledSideEffects();
      } catch (err) {
        console.error('Scheduled side-effects error:', err);
      }
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
