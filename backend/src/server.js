import app from './app.js';
import { connectToDatabase, setupExtraTables, syncDatabase } from './config/database.js';
import { applySchema } from './config/schema.js';
import { seedDatabase } from './config/seedData.js';

const PORT = Number(globalThis.process?.env?.PORT) || 4000;

const startServer = async () => {
  try {
    await connectToDatabase();
    await applySchema();
    await setupExtraTables();
    await syncDatabase();
    try {
      await seedDatabase();
      console.log('Database seeded successfully');
    } catch (seedError) {
      console.error('Seed failed (non-fatal):', seedError.message);
    }

    app.listen(PORT, () => {
      console.log(`API running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start API server:', error);
    globalThis.process?.exit(1);
  }
};

startServer();
