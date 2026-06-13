import 'dotenv/config';
import { Client } from 'pg';

const {
  DB_HOST = 'localhost',
  DB_PORT = '5432',
  DB_NAME = 'BD-PINT',
  DB_USER = 'postgres',
  DB_PASSWORD = 'postgres',
} = globalThis.process?.env ?? {};

const migrateDatabase = async () => {
  const client = new Client({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
  });

  await client.connect();

  try {
    // Check if role column exists
    const checkResult = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name='utilizador' AND column_name='role'
      );
    `);

    if (checkResult.rows[0].exists) {
      console.log('Removing role column from utilizador table...');
      
      // First, update permissoes with role value if permissoes is null
      await client.query(`
        UPDATE utilizador 
        SET permissoes = role 
        WHERE permissoes IS NULL OR permissoes = '';
      `);
      
      // Drop the role column
      await client.query(`
        ALTER TABLE utilizador DROP COLUMN role;
      `);
      
      // Make permissoes NOT NULL with default
      await client.query(`
        ALTER TABLE utilizador 
        ALTER COLUMN permissoes SET NOT NULL,
        ALTER COLUMN permissoes SET DEFAULT 'consultor';
      `);
      
      console.log('Migration completed successfully!');
    } else {
      console.log('role column does not exist. No migration needed.');
    }
  } catch (error) {
    console.error('Migration error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
};

migrateDatabase();
