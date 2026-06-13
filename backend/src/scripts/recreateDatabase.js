import 'dotenv/config';
import { Client } from 'pg';
import { connectToDatabase, sequelize } from '../config/database.js';
import { applySchema } from '../config/schema.js';
import { seedDatabase } from '../config/seedData.js';

const {
  DB_HOST = 'localhost',
  DB_PORT = '5432',
  DB_NAME = 'BD-PINT',
  DB_USER = 'postgres',
  DB_PASSWORD = 'postgres',
} = globalThis.process?.env ?? {};

const escapeIdentifier = (value) => value.replaceAll('"', '""');

const dropAndCreateDatabase = async () => {
  const client = new Client({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    database: 'postgres',
  });

  await client.connect();

  try {
    // Terminate all connections to the database
    await client.query(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = $1 AND pid <> pg_backend_pid()
    `, [DB_NAME]);

    // Drop database if exists
    const escapedName = escapeIdentifier(DB_NAME);
    await client.query(`DROP DATABASE IF EXISTS "${escapedName}"`);
    console.log(`Database ${DB_NAME} dropped.`);

    // Create database
    await client.query(`CREATE DATABASE "${escapedName}"`);
    console.log(`Database ${DB_NAME} created successfully.`);
  } finally {
    await client.end();
  }
};

const recreateDatabase = async () => {
  console.log('=== RECRIANDO BASE DE DADOS ===\n');

  // Step 1: Drop and create database
  await dropAndCreateDatabase();

  // Step 2: Connect and apply schema
  await connectToDatabase();
  console.log('\nConnected to database.');

  try {
    const statementsCount = await applySchema();
    console.log(`Schema applied with ${statementsCount} statements.`);

    // Step 3: Seed data
    await seedDatabase();
    console.log('Seed data applied successfully.');

    console.log('\n=== BASE DE DADOS RECRIADA COM SUCESSO ===');
  } finally {
    await sequelize.close();
  }
};

recreateDatabase().catch((error) => {
  console.error('\n=== ERRO AO RECRIAR BASE DE DADOS ===');
  console.error(error);
  globalThis.process?.exit(1);
});
