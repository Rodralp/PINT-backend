import 'dotenv/config';
import { Client } from 'pg';

const {
  DB_HOST = 'localhost',
  DB_PORT = '5432',
  DB_NAME = 'BD-PINT',
  DB_USER = 'postgres',
  DB_PASSWORD = 'postgres',
} = globalThis.process?.env ?? {};

const escapeIdentifier = (value) => value.replaceAll('"', '""');

const createDatabaseIfMissing = async () => {
  const client = new Client({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    database: 'postgres',
  });

  await client.connect();

  try {
    const checkResult = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [DB_NAME]);

    if (checkResult.rowCount > 0) {
      console.log(`Database ${DB_NAME} already exists.`);
      return;
    }

    const escapedName = escapeIdentifier(DB_NAME);
    await client.query(`CREATE DATABASE "${escapedName}"`);
    console.log(`Database ${DB_NAME} created successfully.`);
  } finally {
    await client.end();
  }
};

createDatabaseIfMissing().catch((error) => {
  console.error('Failed to create database:', error);
  globalThis.process?.exit(1);
});
