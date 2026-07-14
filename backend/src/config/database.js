import 'dotenv/config';
import { Sequelize } from 'sequelize';

const {
  DB_HOST = 'localhost',
  DB_PORT = '5432',
  DB_NAME = 'BD-PINT',
  DB_USER = 'postgres',
  DB_PASSWORD = 'postgres',
  DB_LOGGING = 'false',
} = globalThis.process?.env ?? {};

const shouldLogSql = DB_LOGGING === 'true';

export const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
  host: DB_HOST,
  port: Number(DB_PORT),
  dialect: 'postgres',
  logging: shouldLogSql ? console.log : false,
});

export const connectToDatabase = async () => {
  await sequelize.authenticate();
};

export const syncDatabase = async () => {
  await sequelize.sync({ alter: true });
  console.log('Database synced via Sequelize models');
};