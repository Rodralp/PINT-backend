import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const parseDataUrl = (dataUrl) => {
  const match = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], base64: match[2] };
};

const saveUserImage = async (utilizadorId, imageDataUrl, transaction) => {
  if (!utilizadorId || !imageDataUrl) return;

  const parsed = parseDataUrl(imageDataUrl);
  if (!parsed) return;

  const binaryBuffer = Buffer.from(parsed.base64, 'base64');

  await sequelize.query(
    `
      INSERT INTO utilizador_imagem (nutilizador, mime_type, dados, atualizado_em)
      VALUES (:utilizadorId, :mimeType, :dados, CURRENT_TIMESTAMP)
      ON CONFLICT (nutilizador) DO UPDATE
        SET mime_type = EXCLUDED.mime_type,
            dados = EXCLUDED.dados,
            atualizado_em = CURRENT_TIMESTAMP
    `,
    {
      replacements: {
        utilizadorId,
        mimeType: parsed.mimeType,
        dados: binaryBuffer,
      },
      type: QueryTypes.INSERT,
      transaction,
    },
  );
};

const loadUserImage = async (utilizadorId, transaction) => {
  const options = transaction ? { transaction } : {};
  const [row] = await sequelize.query(
    `
      SELECT mime_type, dados
      FROM utilizador_imagem
      WHERE nutilizador = :utilizadorId
      LIMIT 1
    `,
    {
      replacements: { utilizadorId },
      type: QueryTypes.SELECT,
      ...options,
    },
  );

  if (!row?.dados) return null;

  const base64 = Buffer.isBuffer(row.dados)
    ? row.dados.toString('base64')
    : Buffer.from(row.dados).toString('base64');

  return `data:${row.mime_type};base64,${base64}`;
};

const loadUserImagesBatch = async (utilizadorIds, transaction) => {
  if (!utilizadorIds || utilizadorIds.length === 0) return {};

  const options = transaction ? { transaction } : {};
  const placeholders = utilizadorIds.map((_, i) => `:id${i}`).join(', ');
  const replacements = {};
  utilizadorIds.forEach((id, i) => { replacements[`id${i}`] = id; });

  const rows = await sequelize.query(
    `
      SELECT nutilizador, mime_type, dados
      FROM utilizador_imagem
      WHERE nutilizador IN (${placeholders})
    `,
    {
      replacements,
      type: QueryTypes.SELECT,
      ...options,
    },
  );

  const imageMap = {};
  for (const row of (Array.isArray(rows) ? rows : [])) {
    const base64 = Buffer.isBuffer(row.dados)
      ? row.dados.toString('base64')
      : Buffer.from(row.dados).toString('base64');
    imageMap[row.nutilizador] = `data:${row.mime_type};base64,${base64}`;
  }

  return imageMap;
};

const deleteUserImage = async (utilizadorId, transaction) => {
  if (!utilizadorId) return;
  const options = transaction ? { transaction } : {};
  await sequelize.query(
    `DELETE FROM utilizador_imagem WHERE nutilizador = :utilizadorId`,
    {
      replacements: { utilizadorId },
      type: QueryTypes.DELETE,
      ...options,
    },
  );
};

export const utilizadorImagemModel = {
  saveUserImage,
  loadUserImage,
  loadUserImagesBatch,
  deleteUserImage,
};
