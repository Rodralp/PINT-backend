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
const isProduction = DB_HOST !== 'localhost';

export const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
  host: DB_HOST,
  port: Number(DB_PORT),
  dialect: 'postgres',
  logging: shouldLogSql ? console.log : false,
  pool: {
    max: 10,
    min: 2,
    idle: 30000,
    acquire: 30000,
    evict: 30000,
  },
  retry: {
    max: 3,
    match: [
      /ECONNRESET/,
      /EHOSTUNREACH/,
      /ECONNREFUSED/,
      /ETIMEDOUT/,
      /ENOTFOUND/,
      /ConnectionError/,
      /SequelizeConnectionError/,
      /SequelizeConnectionRefusedError/,
    ],
  },
  ...(isProduction && {
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
  }),
});

let reconnecting = false;

const handleDisconnects = () => {
  const pool = sequelize.connectionManager?.pool;
  if (pool && typeof pool.on === 'function') {
    pool.on('error', (err) => {
      console.error('Database pool error:', err.message);
    });
    pool.on('destroy', () => {
      if (!reconnecting) {
        console.warn('Database connection destroyed, attempting to reconnect...');
        reconnecting = true;
        sequelize.authenticate()
          .then(() => {
            console.log('Database reconnected successfully');
            reconnecting = false;
          })
          .catch((err) => {
            console.error('Database reconnection failed:', err.message);
            reconnecting = false;
          });
      }
    });
  }
};

export const connectToDatabase = async () => {
  await sequelize.authenticate();
  handleDisconnects();
};

export const syncDatabase = async () => {
  await sequelize.sync({ alter: true });
  console.log('Database synced via Sequelize models');
};
