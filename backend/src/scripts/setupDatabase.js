import { sequelize } from '../config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function setupDatabase() {
  try {
    console.log('Connecting to database...');
    await sequelize.authenticate();
    console.log('Database connection successful');

    // Read and execute SQL file
    const sqlFilePath = path.join(__dirname, '..', 'config', 'databaseTables.sql');
    const sql = fs.readFileSync(sqlFilePath, 'utf8');

    console.log('Creating team tables...');
    await sequelize.query(sql);
    console.log('Team tables created successfully');

    console.log('Database setup completed');
  } catch (error) {
    console.error('Database setup failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

setupDatabase();
