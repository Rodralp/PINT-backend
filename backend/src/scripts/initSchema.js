import { connectToDatabase, sequelize } from '../config/database.js';
import { applySchema } from '../config/schema.js';

const runSchemaInit = async () => {
  await connectToDatabase();

  try {
    const appliedStatements = await applySchema();
    console.log(`Schema applied successfully with ${appliedStatements} statements.`);
  } finally {
    await sequelize.close();
  }
};

runSchemaInit().catch((error) => {
  console.error('Failed to initialize schema:', error);
  globalThis.process?.exit(1);
});
