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

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS badge_expiracao_log (
      nlog_expiracao INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      nbadge INTEGER NOT NULL REFERENCES badge(nbadge) ON DELETE CASCADE,
      data_expiracao DATE NOT NULL,
      data_processamento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      pedidos_rejeitados INTEGER DEFAULT 0,
      nivel_desativado BOOLEAN DEFAULT FALSE,
      CONSTRAINT unique_badge_expiracao UNIQUE (nbadge, data_expiracao)
    );
  `);

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS badge_imagem (
      nbadge INTEGER PRIMARY KEY REFERENCES badge(nbadge) ON DELETE CASCADE,
      mime_type VARCHAR(50) NOT NULL DEFAULT 'image/png',
      dados BYTEA NOT NULL,
      criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await sequelize.query(`
    INSERT INTO badge_imagem (nbadge, mime_type, dados, criado_em, atualizado_em)
    SELECT
      b.nbadge,
      COALESCE(
        SUBSTRING(b.imagem FROM '^data:([^;]+);') ,
        'image/png'
      ) AS mime_type,
      DECODE(
        SUBSTRING(b.imagem FROM '^data:[^;]+;base64,(.+)$'),
        'base64'
      ) AS dados,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    FROM badge AS b
    WHERE b.imagem IS NOT NULL
      AND b.imagem LIKE 'data:%;base64,%'
      AND NOT EXISTS (
        SELECT 1 FROM badge_imagem bi WHERE bi.nbadge = b.nbadge
      );
  `);
};

export const syncDatabase = async () => {
  // Temporarily disabled to avoid conflicts with existing database schema
  // await sequelize.sync({ alter: true });
  console.log('Database sync skipped - using existing schema');
};