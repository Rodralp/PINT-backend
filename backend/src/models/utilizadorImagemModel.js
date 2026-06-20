import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const saveUserImage = async (accountId, mimeType, base64Data) => {
  const buffer = Buffer.from(base64Data, 'base64');
  await sequelize.query(
    `
      INSERT INTO utilizador_imagem (nutilizador, mime_type, dados, criado_em, atualizado_em)
      VALUES (:accountId, :mimeType, :dados, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (nutilizador) DO UPDATE
        SET mime_type = :mimeType,
            dados = :dados,
            atualizado_em = CURRENT_TIMESTAMP
    `,
    {
      replacements: { accountId, mimeType, dados: buffer },
    },
  );
};

const getUserImage = async (accountId) => {
  const [row] = await sequelize.query(
    `
      SELECT mime_type, dados
      FROM utilizador_imagem
      WHERE nutilizador = :accountId
      LIMIT 1
    `,
    {
      replacements: { accountId },
      type: QueryTypes.SELECT,
    },
  );

  if (!row || !row.dados) return null;

  const base64 = Buffer.isBuffer(row.dados)
    ? row.dados.toString('base64')
    : Buffer.from(row.dados).toString('base64');

  return { mimeType: row.mime_type || 'image/png', dataUrl: `data:${row.mime_type};base64,${base64}` };
};

const loadUserImagesBatch = async (accountIds) => {
  if (!accountIds || accountIds.length === 0) return {};

  const placeholders = accountIds.map((_, i) => `:id${i}`).join(', ');
  const replacements = {};
  accountIds.forEach((id, i) => { replacements[`id${i}`] = id; });

  const rows = await sequelize.query(
    `
      SELECT nutilizador, mime_type, dados
      FROM utilizador_imagem
      WHERE nutilizador IN (${placeholders})
    `,
    { replacements, type: QueryTypes.SELECT },
  );

  const map = {};
  for (const row of rows) {
    const base64 = Buffer.isBuffer(row.dados)
      ? row.dados.toString('base64')
      : Buffer.from(row.dados).toString('base64');
    map[row.nutilizador] = `data:${row.mime_type};base64,${base64}`;
  }
  return map;
};

const deleteUserImage = async (accountId) => {
  await sequelize.query(
    'DELETE FROM utilizador_imagem WHERE nutilizador = :accountId',
    { replacements: { accountId } },
  );
};

export const utilizadorImagemModel = {
  saveUserImage,
  getUserImage,
  loadUserImagesBatch,
  deleteUserImage,
};
