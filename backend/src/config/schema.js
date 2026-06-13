import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sequelize } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const schemaPath = path.resolve(__dirname, '../../database/schema_postgresql.sql');

const normalizeSql = (sql) =>
  sql
    .split('\n')
    .map((line) => {
      const commentIndex = line.indexOf('--');
      return commentIndex >= 0 ? line.slice(0, commentIndex) : line;
    })
    .join('\n');

const splitStatements = (sql) =>
  normalizeSql(sql)
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);

export const applySchema = async () => {
  const schemaSql = await readFile(schemaPath, 'utf8');
  const statements = splitStatements(schemaSql);

  for (const statement of statements) {
    await sequelize.query(statement);
  }

  return statements.length;
};
