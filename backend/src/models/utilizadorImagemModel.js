import { UtilizadorImagem } from './sql/UtilizadorImagem.js';

const parseDataUrl = (dataUrl) => {
  const match = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], base64: match[2] };
};

const toDataUrl = (row) => {
  if (!row?.dados) return null;

  const base64 = Buffer.isBuffer(row.dados)
    ? row.dados.toString('base64')
    : Buffer.from(row.dados).toString('base64');

  return `data:${row.mime_type};base64,${base64}`;
};

const saveUserImage = async (utilizadorId, imageDataUrl, transaction) => {
  if (!utilizadorId || !imageDataUrl) return;

  const parsed = parseDataUrl(imageDataUrl);
  if (!parsed) return;

  const binaryBuffer = Buffer.from(parsed.base64, 'base64');

  await UtilizadorImagem.upsert(
    {
      nutilizador: utilizadorId,
      mime_type: parsed.mimeType,
      dados: binaryBuffer,
      atualizado_em: new Date(),
    },
    { transaction },
  );
};

const loadUserImage = async (utilizadorId, transaction) => {
  const row = await UtilizadorImagem.findOne({
    where: { nutilizador: utilizadorId },
    attributes: ['mime_type', 'dados'],
    transaction,
  });

  return toDataUrl(row);
};

const loadUserImagesBatch = async (utilizadorIds, transaction) => {
  if (!utilizadorIds || utilizadorIds.length === 0) return {};

  const rows = await UtilizadorImagem.findAll({
    where: { nutilizador: utilizadorIds },
    attributes: ['nutilizador', 'mime_type', 'dados'],
    transaction,
  });

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

  await UtilizadorImagem.destroy({
    where: { nutilizador: utilizadorId },
    transaction,
  });
};

export const utilizadorImagemModel = {
  saveUserImage,
  loadUserImage,
  loadUserImagesBatch,
  deleteUserImage,
};
