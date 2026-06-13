import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/database.js';
import { communicationModel } from './communicationModel.js';

const SPECIAL_BADGE_TYPE_NAME = 'Especial';
const SPECIAL_BADGE_TYPE_KEY = 'special';

const badgeTypeMatchers = [
  { key: 'badge_level_junior', matchers: ['junior'] },
  { key: 'badge_level_intermediate', matchers: ['intermedio', 'interm'] },
  { key: 'badge_level_senior', matchers: ['senior'] },
  { key: 'badge_level_specialist', matchers: ['especialista'] },
  { key: 'badge_level_knowledge_lead', matchers: ['lider de conhecimento', 'lider'] },
];

const specialTriggerTypes = new Set(['badge_count', 'ranking_position', 'streak_days']);

const normalizeForCompare = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const parseId = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const normalizeBadgeImage = (value) => {
  const normalized = String(value || '').trim();
  return normalized || null;
};

const parseDataUrl = (dataUrl) => {
  const match = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], base64: match[2] };
};

const isDataUrl = (value) => String(value || '').startsWith('data:');

const saveBadgeImage = async (badgeId, imageDataUrl, transaction) => {
  if (!badgeId || !imageDataUrl) return;

  const parsed = parseDataUrl(imageDataUrl);
  if (!parsed) return;

  const binaryBuffer = Buffer.from(parsed.base64, 'base64');

  await sequelize.query(
    `
      INSERT INTO badge_imagem (nbadge, mime_type, dados, atualizado_em)
      VALUES (:badgeId, :mimeType, :dados, CURRENT_TIMESTAMP)
      ON CONFLICT (nbadge) DO UPDATE
        SET mime_type = EXCLUDED.mime_type,
            dados = EXCLUDED.dados,
            atualizado_em = CURRENT_TIMESTAMP
    `,
    {
      replacements: {
        badgeId,
        mimeType: parsed.mimeType,
        dados: binaryBuffer,
      },
      type: QueryTypes.INSERT,
      transaction,
    },
  );
};

const loadBadgeImage = async (badgeId, transaction) => {
  const options = transaction ? { transaction } : {};
  const [row] = await sequelize.query(
    `
      SELECT mime_type, dados
      FROM badge_imagem
      WHERE nbadge = :badgeId
      LIMIT 1
    `,
    {
      replacements: { badgeId },
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

const loadBadgeImagesBatch = async (badgeIds, transaction) => {
  if (!badgeIds || badgeIds.length === 0) return {};

  const options = transaction ? { transaction } : {};
  const placeholders = badgeIds.map((_, i) => `:id${i}`).join(', ');
  const replacements = {};
  badgeIds.forEach((id, i) => { replacements[`id${i}`] = id; });

  const [rows] = await sequelize.query(
    `
      SELECT nbadge, mime_type, dados
      FROM badge_imagem
      WHERE nbadge IN (${placeholders})
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
    imageMap[row.nbadge] = `data:${row.mime_type};base64,${base64}`;
  }

  return imageMap;
};

const deleteBadgeImage = async (badgeId, transaction) => {
  if (!badgeId) return;
  const options = transaction ? { transaction } : {};
  await sequelize.query(
    `DELETE FROM badge_imagem WHERE nbadge = :badgeId`,
    {
      replacements: { badgeId },
      type: QueryTypes.DELETE,
      ...options,
    },
  );
};

const ensureEstadoId = async (estadoNome) => {
  const [existing] = await sequelize.query(
    `
      SELECT nestado
      FROM estado
      WHERE LOWER(estado) = LOWER(:nome)
      LIMIT 1
    `,
    {
      replacements: { nome: estadoNome },
      type: QueryTypes.SELECT,
    },
  );

  if (existing?.nestado) {
    return existing.nestado;
  }

  const [inserted] = await sequelize.query(
    `
      INSERT INTO estado (estado)
      VALUES (:nome)
      RETURNING nestado
    `,
    {
      replacements: { nome: estadoNome },
      type: QueryTypes.SELECT,
    },
  );

  return inserted?.nestado;
};

const resolveUtilizadorId = async (accountId) => {
  const parsedAccountId = Number(accountId);
  if (!Number.isInteger(parsedAccountId) || parsedAccountId <= 0) {
    return null;
  }

  const [row] = await sequelize.query(
    `
      SELECT nutilizador
      FROM utilizador
      WHERE nutilizador = :accountId
      LIMIT 1
    `,
    {
      replacements: { accountId: parsedAccountId },
      type: QueryTypes.SELECT,
    },
  );

  return row?.nutilizador || null;
};

const normalizeSpecialRequirements = (requirements) => {
  if (!Array.isArray(requirements)) {
    return [];
  }

  const uniqueByType = new Map();

  for (const requirement of requirements) {
    const type = String(requirement?.type || '').trim();
    const value = Number(requirement?.value);

    if (!specialTriggerTypes.has(type) || !Number.isInteger(value) || value <= 0) {
      continue;
    }

    if (!uniqueByType.has(type)) {
      uniqueByType.set(type, { type, value });
    }
  }

  return Array.from(uniqueByType.values());
};

const normalizeStandardRequirements = (requirements) => {
  if (!Array.isArray(requirements)) {
    return [];
  }

  const normalized = [];

  for (const requirement of requirements) {
    const title = String(requirement?.title || requirement?.requisito || '').trim();
    const description = String(requirement?.description || requirement?.r_descricao || '').trim();
    const image = normalizeBadgeImage(requirement?.image || requirement?.imagem);

    if (!title || !description) {
      continue;
    }

    normalized.push({
      title: title.slice(0, 50),
      description: description.slice(0, 255),
      image,
    });
  }

  return normalized;
};

const getBadgeTypes = async (transaction) => sequelize.query(
  `
    SELECT ntipo, tipo
    FROM tipo
    ORDER BY ntipo ASC
  `,
  {
    type: QueryTypes.SELECT,
    transaction,
  },
);

const getTypeNameById = async (typeId, transaction) => {
  const [row] = await sequelize.query(
    `
      SELECT tipo
      FROM tipo
      WHERE ntipo = :typeId
      LIMIT 1
    `,
    {
      replacements: { typeId: Number(typeId) },
      type: QueryTypes.SELECT,
      transaction,
    },
  );

  return row?.tipo || null;
};

const ensureSpecialBadgeTypeId = async (transaction) => {
  const [existing] = await sequelize.query(
    `
      SELECT ntipo
      FROM tipo
      WHERE LOWER(tipo) = LOWER(:typeName)
      LIMIT 1
    `,
    {
      replacements: { typeName: SPECIAL_BADGE_TYPE_NAME },
      type: QueryTypes.SELECT,
      transaction,
    },
  );

  if (existing?.ntipo) {
    return Number(existing.ntipo);
  }

  const [inserted] = await sequelize.query(
    `
      INSERT INTO tipo (tipo)
      VALUES (:typeName)
      RETURNING ntipo
    `,
    {
      replacements: { typeName: SPECIAL_BADGE_TYPE_NAME },
      type: QueryTypes.SELECT,
      transaction,
    },
  );

  return inserted?.ntipo ? Number(inserted.ntipo) : null;
};

const resolveBadgeTypeGroup = (value) => {
  const normalized = normalizeForCompare(value);
  if (!normalized) {
    return null;
  }

  return badgeTypeMatchers.find((group) =>
    normalizeForCompare(group.key) === normalized
    || group.matchers.some((matcher) => normalized.includes(matcher)),
  ) || null;
};

const resolveStandardBadgeTypeId = async ({ requestedTypeId, levelTitle, transaction }) => {
  const types = await getBadgeTypes(transaction);
  const standardTypes = (types || []).filter((type) =>
    normalizeForCompare(type.tipo) !== normalizeForCompare(SPECIAL_BADGE_TYPE_NAME),
  );

  if (standardTypes.length === 0) {
    return null;
  }

  const numericRequestedTypeId = parseId(requestedTypeId);
  if (numericRequestedTypeId) {
    const directMatch = standardTypes.find((type) => Number(type.ntipo) === numericRequestedTypeId);
    if (directMatch?.ntipo) {
      return Number(directMatch.ntipo);
    }
  }

  const requestedTypeGroup = resolveBadgeTypeGroup(requestedTypeId);
  if (requestedTypeGroup) {
    const typeByGroup = standardTypes.find((type) =>
      requestedTypeGroup.matchers.some((matcher) => normalizeForCompare(type.tipo).includes(matcher)),
    );

    if (typeByGroup?.ntipo) {
      return Number(typeByGroup.ntipo);
    }
  }

  const normalizedRequestedType = normalizeForCompare(requestedTypeId);
  if (normalizedRequestedType) {
    const directNameMatch = standardTypes.find((type) => {
      const normalizedTypeName = normalizeForCompare(type.tipo);
      return normalizedTypeName === normalizedRequestedType || normalizedTypeName.includes(normalizedRequestedType);
    });

    if (directNameMatch?.ntipo) {
      return Number(directNameMatch.ntipo);
    }
  }

  const levelTypeGroup = resolveBadgeTypeGroup(levelTitle);
  if (levelTypeGroup) {
    const typeByLevel = standardTypes.find((type) =>
      levelTypeGroup.matchers.some((matcher) => normalizeForCompare(type.tipo).includes(matcher)),
    );

    if (typeByLevel?.ntipo) {
      return Number(typeByLevel.ntipo);
    }
  }

  return Number(standardTypes[0].ntipo);
};

const getLevelContext = async (levelId, transaction) => {
  const [row] = await sequelize.query(
    `
      SELECT
        n.nnivel,
        n.nivel,
        a.narea,
        sl.nsline,
        sl.nlpath
      FROM nivel AS n
      LEFT JOIN area AS a
        ON a.narea = n.narea
      LEFT JOIN service_line AS sl
        ON sl.nsline = a.nsline
      WHERE n.nnivel = :levelId
      LIMIT 1
    `,
    {
      replacements: { levelId: Number(levelId) },
      type: QueryTypes.SELECT,
      transaction,
    },
  );

  if (!row?.nnivel) {
    return null;
  }

  return {
    levelId: Number(row.nnivel),
    levelTitle: row.nivel,
    areaId: row.narea ? Number(row.narea) : null,
    serviceLineId: row.nsline ? Number(row.nsline) : null,
    learningPathId: row.nlpath ? Number(row.nlpath) : null,
  };
};

const clearBadgeAssociations = async (badgeId, transaction) => {
  await sequelize.query(
    'DELETE FROM nivel_contem_b WHERE nbadge = :badgeId',
    {
      replacements: { badgeId: Number(badgeId) },
      type: QueryTypes.DELETE,
      transaction,
    },
  );

  await sequelize.query(
    'DELETE FROM b_pertence_a WHERE nbadge = :badgeId',
    {
      replacements: { badgeId: Number(badgeId) },
      type: QueryTypes.DELETE,
      transaction,
    },
  );

  await sequelize.query(
    'DELETE FROM b_pertence_sl WHERE nbadge = :badgeId',
    {
      replacements: { badgeId: Number(badgeId) },
      type: QueryTypes.DELETE,
      transaction,
    },
  );

  await sequelize.query(
    'DELETE FROM b_pertence_lp WHERE nbadge = :badgeId',
    {
      replacements: { badgeId: Number(badgeId) },
      type: QueryTypes.DELETE,
      transaction,
    },
  );
};

const replaceBadgeTriggers = async (badgeId, requirements, transaction) => {
  await sequelize.query(
    'DELETE FROM badge_trigger WHERE nbadge = :badgeId',
    {
      replacements: { badgeId: Number(badgeId) },
      type: QueryTypes.DELETE,
      transaction,
    },
  );

  const normalizedRequirements = normalizeSpecialRequirements(requirements);

  for (const requirement of normalizedRequirements) {
    await sequelize.query(
      `
        INSERT INTO badge_trigger (nbadge, trigger_tipo, trigger_valor)
        VALUES (:badgeId, :triggerType, :triggerValue)
      `,
      {
        replacements: {
          badgeId: Number(badgeId),
          triggerType: requirement.type,
          triggerValue: requirement.value,
        },
        type: QueryTypes.INSERT,
        transaction,
      },
    );
  }
};

const loadBadgeTriggers = async (badgeId, transaction) => {
  const rows = await sequelize.query(
    `
      SELECT trigger_tipo, trigger_valor
      FROM badge_trigger
      WHERE nbadge = :badgeId
      ORDER BY trigger_tipo ASC
    `,
    {
      replacements: { badgeId: Number(badgeId) },
      type: QueryTypes.SELECT,
      transaction,
    },
  );

  return (rows || []).map((row) => ({
    type: row.trigger_tipo,
    value: Number(row.trigger_valor),
  }));
};

const loadBadgeRequirements = async (badgeId, transaction) => {
  const rows = await sequelize.query(
    `
      SELECT nreq, requisito, r_descricao, imagem
      FROM requisitos
      WHERE nbadge = :badgeId
      ORDER BY nreq ASC
    `,
    {
      replacements: { badgeId: Number(badgeId) },
      type: QueryTypes.SELECT,
      transaction,
    },
  );

  return (rows || []).map((row) => ({
    id: `req-${Number(row.nreq)}`,
    title: row.requisito || 'Requisito',
    description: row.r_descricao || '',
    image: row.imagem || null,
  }));
};

const replaceBadgeRequirements = async (badgeId, requirements, transaction) => {
  await sequelize.query(
    'DELETE FROM requisitos WHERE nbadge = :badgeId',
    {
      replacements: { badgeId: Number(badgeId) },
      type: QueryTypes.DELETE,
      transaction,
    },
  );

  const normalizedRequirements = normalizeStandardRequirements(requirements);

  for (const requirement of normalizedRequirements) {
    await sequelize.query(
      `
        INSERT INTO requisitos (requisito, r_descricao, imagem, nbadge)
        VALUES (:title, :description, :image, :badgeId)
      `,
      {
        replacements: {
          title: requirement.title,
          description: requirement.description,
          image: requirement.image,
          badgeId: Number(badgeId),
        },
        type: QueryTypes.INSERT,
        transaction,
      },
    );
  }
};

const createBadgeAssociations = async (badgeId, levelContext, transaction) => {
  if (!levelContext) {
    return;
  }

  await sequelize.query(
    `
      INSERT INTO nivel_contem_b (nnivel, nbadge)
      VALUES (:levelId, :badgeId)
      ON CONFLICT DO NOTHING
    `,
    {
      replacements: {
        levelId: levelContext.levelId,
        badgeId: Number(badgeId),
      },
      type: QueryTypes.INSERT,
      transaction,
    },
  );

  if (levelContext.areaId) {
    await sequelize.query(
      `
        INSERT INTO b_pertence_a (narea, nbadge)
        VALUES (:areaId, :badgeId)
        ON CONFLICT DO NOTHING
      `,
      {
        replacements: {
          areaId: levelContext.areaId,
          badgeId: Number(badgeId),
        },
        type: QueryTypes.INSERT,
        transaction,
      },
    );
  }

  if (levelContext.serviceLineId) {
    await sequelize.query(
      `
        INSERT INTO b_pertence_sl (nsline, nbadge)
        VALUES (:serviceLineId, :badgeId)
        ON CONFLICT DO NOTHING
      `,
      {
        replacements: {
          serviceLineId: levelContext.serviceLineId,
          badgeId: Number(badgeId),
        },
        type: QueryTypes.INSERT,
        transaction,
      },
    );
  }

  if (levelContext.learningPathId) {
    await sequelize.query(
      `
        INSERT INTO b_pertence_lp (nlpath, nbadge)
        VALUES (:learningPathId, :badgeId)
        ON CONFLICT DO NOTHING
      `,
      {
        replacements: {
          learningPathId: levelContext.learningPathId,
          badgeId: Number(badgeId),
        },
        type: QueryTypes.INSERT,
        transaction,
      },
    );
  }
};

const mapBadgeTypeMeta = (typeName) => {
  const normalizedTypeName = normalizeForCompare(typeName);

  if (normalizedTypeName === normalizeForCompare(SPECIAL_BADGE_TYPE_NAME)) {
    return {
      isSpecial: true,
      typeKey: SPECIAL_BADGE_TYPE_KEY,
    };
  }

  const matchedGroup = badgeTypeMatchers.find((group) =>
    group.matchers.some((matcher) => normalizedTypeName.includes(matcher)),
  );

  return {
    isSpecial: false,
    typeKey: matchedGroup?.key || null,
  };
};

const mapBadgeResponse = ({ badgeRow, levelContext, typeName, specialRequirements, requirements }) => {
  const typeMeta = mapBadgeTypeMeta(typeName);

  return {
    nbadge: Number(badgeRow.nbadge),
    b_nome: badgeRow.b_nome,
    b_descricao: badgeRow.b_descricao,
    pontos: Number(badgeRow.pontos) || 0,
    imagem: badgeRow.imagem || null,
    ntipo: Number(badgeRow.ntipo),
    typeName: typeName || null,
    typeKey: typeMeta.typeKey,
    levelId: levelContext?.levelId || null,
    levelTitle: levelContext?.levelTitle || null,
    isSpecial: typeMeta.isSpecial,
    specialRequirements: specialRequirements || [],
    requirements: requirements || [],
    validade: badgeRow.validade || null,
  };
};

const fetchBadgeLevelContextByBadgeId = async (badgeId, transaction) => {
  const [row] = await sequelize.query(
    `
      SELECT
        n.nnivel,
        n.nivel
      FROM nivel_contem_b AS ncb
      LEFT JOIN nivel AS n
        ON n.nnivel = ncb.nnivel
      WHERE ncb.nbadge = :badgeId
      ORDER BY n.nnivel ASC
      LIMIT 1
    `,
    {
      replacements: { badgeId: Number(badgeId) },
      type: QueryTypes.SELECT,
      transaction,
    },
  );

  if (!row?.nnivel) {
    return null;
  }

  return {
    levelId: Number(row.nnivel),
    levelTitle: row.nivel || null,
  };
};

export const adminBadgeModel = {
  async createBadge({ name, description, points, levelId, isSpecial, typeId, badgeImage, specialRequirements, requirements, validade }) {
    return sequelize.transaction(async (transaction) => {
      const safePoints = Number.isFinite(Number(points)) ? Number(points) : 0;
      const parsedLevelId = parseId(levelId);
      const levelContext = isSpecial ? null : await getLevelContext(parsedLevelId, transaction);

      if (!isSpecial && !levelContext) {
        return null;
      }

      const resolvedTypeId = isSpecial
        ? await ensureSpecialBadgeTypeId(transaction)
        : await resolveStandardBadgeTypeId({
          requestedTypeId: typeId,
          levelTitle: levelContext?.levelTitle,
          transaction,
        });

      if (!resolvedTypeId) {
        return null;
      }

      const safeImage = normalizeBadgeImage(badgeImage);
      const safeValidade = validade || null;

      const [badgeRow] = await sequelize.query(
        `
          INSERT INTO badge (b_nome, b_descricao, pontos, imagem, ntipo, validade)
          VALUES (:name, :description, :points, :image, :typeId, :validade)
          RETURNING nbadge, b_nome, b_descricao, pontos, imagem, ntipo, validade
        `,
        {
          replacements: {
            name,
            description,
            points: safePoints,
            image: safeImage,
            typeId: resolvedTypeId,
            validade: safeValidade,
          },
          type: QueryTypes.SELECT,
          transaction,
        },
      );

      if (!badgeRow?.nbadge) {
        return null;
      }

      if (isDataUrl(safeImage)) {
        await saveBadgeImage(badgeRow.nbadge, safeImage, transaction);
      }

      if (!isSpecial) {
        await createBadgeAssociations(badgeRow.nbadge, levelContext, transaction);
      }

      await replaceBadgeTriggers(badgeRow.nbadge, isSpecial ? specialRequirements : [], transaction);

      await replaceBadgeRequirements(badgeRow.nbadge, isSpecial ? [] : requirements, transaction);

      const [typeName, triggerRows, requirementRows] = await Promise.all([
        getTypeNameById(resolvedTypeId, transaction),
        loadBadgeTriggers(badgeRow.nbadge, transaction),
        loadBadgeRequirements(badgeRow.nbadge, transaction),
      ]);

      const imageFromDb = await loadBadgeImage(badgeRow.nbadge, transaction);
      badgeRow.imagem = imageFromDb || badgeRow.imagem;

      return mapBadgeResponse({
        badgeRow,
        levelContext,
        typeName,
        specialRequirements: triggerRows,
        requirements: requirementRows,
      });
    });
  },

  async updateBadge({ badgeId, name, description, points, levelId, isSpecial, typeId, badgeImage, specialRequirements, requirements, validade }) {
    return sequelize.transaction(async (transaction) => {
      const parsedBadgeId = parseId(badgeId);
      if (!parsedBadgeId) {
        return null;
      }

      const safePoints = Number.isFinite(Number(points)) ? Number(points) : 0;
      const parsedLevelId = parseId(levelId);
      const levelContext = isSpecial ? null : await getLevelContext(parsedLevelId, transaction);

      if (!isSpecial && !levelContext) {
        return null;
      }

      const resolvedTypeId = isSpecial
        ? await ensureSpecialBadgeTypeId(transaction)
        : await resolveStandardBadgeTypeId({
          requestedTypeId: typeId,
          levelTitle: levelContext?.levelTitle,
          transaction,
        });

      if (!resolvedTypeId) {
        return null;
      }

      const safeImage = normalizeBadgeImage(badgeImage);
      const safeValidade = validade || null;

      const [badgeRow] = await sequelize.query(
        `
          UPDATE badge
          SET b_nome = :name,
              b_descricao = :description,
              pontos = :points,
              imagem = :image,
              ntipo = :typeId,
              validade = :validade
          WHERE nbadge = :badgeId
          RETURNING nbadge, b_nome, b_descricao, pontos, imagem, ntipo, validade
        `,
        {
          replacements: {
            badgeId: parsedBadgeId,
            name,
            description,
            points: safePoints,
            image: safeImage,
            typeId: resolvedTypeId,
            validade: safeValidade,
          },
          type: QueryTypes.SELECT,
          transaction,
        },
      );

      if (!badgeRow?.nbadge) {
        return null;
      }

      if (isDataUrl(safeImage)) {
        await saveBadgeImage(parsedBadgeId, safeImage, transaction);
      } else if (safeImage === null) {
        await deleteBadgeImage(parsedBadgeId, transaction);
      }

      await clearBadgeAssociations(parsedBadgeId, transaction);
      if (!isSpecial) {
        await createBadgeAssociations(parsedBadgeId, levelContext, transaction);
      }

      await replaceBadgeTriggers(parsedBadgeId, isSpecial ? specialRequirements : [], transaction);

      await replaceBadgeRequirements(parsedBadgeId, isSpecial ? [] : requirements, transaction);

      const [typeName, triggerRows, requirementRows] = await Promise.all([
        getTypeNameById(resolvedTypeId, transaction),
        loadBadgeTriggers(parsedBadgeId, transaction),
        loadBadgeRequirements(parsedBadgeId, transaction),
      ]);

      const imageFromDb = await loadBadgeImage(parsedBadgeId, transaction);
      badgeRow.imagem = imageFromDb || badgeRow.imagem;

      return mapBadgeResponse({
        badgeRow,
        levelContext,
        typeName,
        specialRequirements: triggerRows,
        requirements: requirementRows,
      });
    });
  },

  async getBadge(badgeId) {
    const parsedBadgeId = parseId(badgeId);
    if (!parsedBadgeId) {
      return null;
    }

    const [row, specialRequirements, requirementRows] = await Promise.all([
      sequelize.query(
        `
          SELECT
            b.nbadge,
            b.b_nome,
            b.b_descricao,
            b.pontos,
            b.imagem,
            b.ntipo,
            b.validade,
            t.tipo
          FROM badge AS b
          LEFT JOIN tipo AS t
            ON t.ntipo = b.ntipo
          WHERE b.nbadge = :badgeId
          LIMIT 1
        `,
        {
          replacements: { badgeId: parsedBadgeId },
          type: QueryTypes.SELECT,
        },
      ),
      loadBadgeTriggers(parsedBadgeId),
      loadBadgeRequirements(parsedBadgeId),
    ]);

    if (!row || row.length === 0) {
      return null;
    }

    const badgeRow = row[0];
    const levelContext = await fetchBadgeLevelContextByBadgeId(parsedBadgeId);

    const imageFromDb = await loadBadgeImage(parsedBadgeId);
    badgeRow.imagem = imageFromDb || badgeRow.imagem;

    return mapBadgeResponse({
      badgeRow,
      levelContext,
      typeName: badgeRow.tipo,
      specialRequirements,
      requirements: requirementRows,
    });
  },

  async checkAndExpireBadges() {
    try {
      const expiredBadgesResult = await sequelize.transaction(async (transaction) => {
        const expiredBadges = await sequelize.query(
          `
            SELECT b.nbadge, b.b_nome, b.validade
            FROM badge b
            WHERE b.validade IS NOT NULL
              AND b.validade <= CURRENT_DATE
              AND NOT EXISTS (
                SELECT 1 FROM badge_expiracao_log bel
                WHERE bel.nbadge = b.nbadge
                  AND bel.data_expiracao = b.validade
              )
          `,
          {
            type: QueryTypes.SELECT,
            transaction,
          },
        );

        if (!expiredBadges || expiredBadges.length === 0) {
          return { expired: 0, rejeitados: 0, niveisDesativados: 0, processedBadges: [] };
        }

        let totalRejeitados = 0;
        let totalNiveisDesativados = 0;
        const processedBadges = [];

        const rejeitadoId = await ensureEstadoId('rejeitado');
        const aprovadoId = await ensureEstadoId('aprovado');

        for (const badge of expiredBadges) {
          const badgeId = badge.nbadge;

          const updateResult = await sequelize.query(
            `
              UPDATE pedidos
              SET estado = :rejeitadoId,
                  descricao = COALESCE(NULLIF(descricao, ''), :defaultDescription)
              WHERE nbadge = :badgeId
                AND estado <> :rejeitadoId
                AND estado <> :aprovadoId
            `,
            {
              replacements: {
                badgeId,
                rejeitadoId,
                aprovadoId,
                defaultDescription: 'Candidatura rejeitada automaticamente porque a badge expirou.',
              },
              type: QueryTypes.UPDATE,
              transaction,
            },
          );

          totalRejeitados += updateResult[1] || 0;

          try {
            await sequelize.query(
              `
                INSERT INTO badge_expiracao_log (nbadge, data_expiracao, pedidos_rejeitados)
                VALUES (:badgeId, :validade, :rejeitados)
                ON CONFLICT (nbadge, data_expiracao) DO NOTHING
              `,
              {
                replacements: {
                  badgeId,
                  validade: badge.validade,
                  rejeitados: updateResult[1] || 0,
                },
                type: QueryTypes.INSERT,
                transaction,
              },
            );
          } catch (logError) {
            // badge_expiracao_log table may not exist yet; ignore log errors
          }

          const nivelDesativado = await deactivateLevelIfNoActiveBadges(badgeId, transaction);
          if (nivelDesativado) {
            totalNiveisDesativados++;
          }

          processedBadges.push({ id: badgeId, name: badge.b_nome });
        }

        return {
          expired: expiredBadges.length,
          rejeitados: totalRejeitados,
          niveisDesativados: totalNiveisDesativados,
          processedBadges,
        };
      });

      for (const badge of expiredBadgesResult.processedBadges) {
        try {
          await communicationModel.dispatchBadgeExpiredNotification(badge.id, badge.name);
        } catch (notifError) {
          console.error('Error dispatching badge expired notification:', notifError);
        }
      }

      try {
        const { consultorModel } = await import('./consultorModel.js');
        await consultorModel.sendAllExpirationNotifications();
      } catch (expiringError) {
        console.error('Error sending expiring notifications:', expiringError);
      }

      return {
        expired: expiredBadgesResult.expired,
        rejeitados: expiredBadgesResult.rejeitados,
        niveisDesativados: expiredBadgesResult.niveisDesativados,
      };
    } catch (error) {
      console.error('Error in checkAndExpireBadges:', error);
      return { expired: 0, rejeitados: 0, niveisDesativados: 0 };
    }
  },

  async getExpiringSoonBadges(daysThreshold = 30) {
    const rows = await sequelize.query(
      `
        SELECT
          b.nbadge,
          b.b_nome,
          b.b_descricao,
          b.validade,
          b.pontos,
          b.imagem,
          t.tipo,
          n.nnivel,
          n.nivel AS nivel_nome,
          a.area
        FROM badge AS b
        LEFT JOIN tipo AS t
          ON b.ntipo = t.ntipo
        LEFT JOIN nivel_contem_b AS ncb
          ON b.nbadge = ncb.nbadge
        LEFT JOIN nivel AS n
          ON ncb.nnivel = n.nnivel
        LEFT JOIN area AS a
          ON n.narea = a.narea
        WHERE b.validade IS NOT NULL
          AND b.validade > CURRENT_DATE
          AND b.validade <= CURRENT_DATE + INTERVAL '1 day' * :days
        ORDER BY b.validade ASC
      `,
      {
        replacements: { days: daysThreshold },
        type: QueryTypes.SELECT,
      },
    );

    const results = rows.map((row) => ({
      nbadge: Number(row.nbadge),
      b_nome: row.b_nome,
      b_descricao: row.b_descricao,
      validade: row.validade,
      pontos: Number(row.pontos) || 0,
      imagem: row.imagem || null,
      tipo: row.tipo,
      nnivel: row.nnivel ? Number(row.nnivel) : null,
      nivel_nome: row.nivel_nome || null,
      area: row.area || null,
    }));

    const badgeIds = results.map((r) => r.nbadge).filter(Boolean);
    const imageMap = await loadBadgeImagesBatch(badgeIds);

    for (const item of results) {
      if (imageMap[item.nbadge]) {
        item.imagem = imageMap[item.nbadge];
      }
    }

    return results;
  },

  async getExpiringSoonBadgesForUser(accountId, daysThreshold = 30) {
    const utilizadorId = await resolveUtilizadorId(accountId);
    if (!utilizadorId) {
      return [];
    }

    const rows = await sequelize.query(
      `
        SELECT
          b.nbadge,
          b.b_nome,
          b.b_descricao,
          b.validade,
          b.pontos,
          b.imagem,
          t.tipo,
          cb.data_obtencao
        FROM c_obtem_b AS cb
        INNER JOIN badge AS b
          ON b.nbadge = cb.nbadge
        LEFT JOIN tipo AS t
          ON b.ntipo = t.ntipo
        WHERE cb.nutilizador = :utilizadorId
          AND b.validade IS NOT NULL
          AND b.validade > CURRENT_DATE
          AND b.validade <= CURRENT_DATE + INTERVAL '1 day' * :days
        ORDER BY b.validade ASC
      `,
      {
        replacements: { utilizadorId, days: daysThreshold },
        type: QueryTypes.SELECT,
      },
    );

    const results = rows.map((row) => ({
      nbadge: Number(row.nbadge),
      b_nome: row.b_nome,
      b_descricao: row.b_descricao,
      validade: row.validade,
      pontos: Number(row.pontos) || 0,
      imagem: row.imagem || null,
      tipo: row.tipo,
      data_obtencao: row.data_obtencao,
    }));

    const badgeIds = results.map((r) => r.nbadge).filter(Boolean);
    const imageMap = await loadBadgeImagesBatch(badgeIds);

    for (const item of results) {
      if (imageMap[item.nbadge]) {
        item.imagem = imageMap[item.nbadge];
      }
    }

    return results;
  },

  loadBadgeImagesBatch,
};

async function deactivateLevelIfNoActiveBadges(badgeId, transaction) {
  const nivelRow = await sequelize.query(
    `
      SELECT ncb.nnivel
      FROM nivel_contem_b AS ncb
      WHERE ncb.nbadge = :badgeId
      LIMIT 1
    `,
    {
      replacements: { badgeId },
      type: QueryTypes.SELECT,
      transaction,
    },
  );

  if (!nivelRow || nivelRow.length === 0) {
    return false;
  }

  const nivelId = nivelRow[0].nnivel;

  const activeBadgesInLevel = await sequelize.query(
    `
      SELECT COUNT(*) AS cnt
      FROM nivel_contem_b AS ncb
      INNER JOIN badge AS b
        ON b.nbadge = ncb.nbadge
      WHERE ncb.nnivel = :nivelId
        AND (b.validade IS NULL OR b.validade > CURRENT_DATE)
    `,
    {
      replacements: { nivelId },
      type: QueryTypes.SELECT,
      transaction,
    },
  );

  if (activeBadgesInLevel[0]?.cnt > 0) {
    return false;
  }

  await sequelize.query(
    `
      UPDATE nivel
      SET is_active = FALSE
      WHERE nnivel = :nivelId
    `,
    {
      replacements: { nivelId },
      type: QueryTypes.UPDATE,
      transaction,
    },
  );

  try {
    await sequelize.query(
      `
        UPDATE badge_expiracao_log
        SET nivel_desativado = TRUE
        WHERE nbadge = :badgeId
          AND nivel_desativado = FALSE
      `,
      {
        replacements: { badgeId },
        type: QueryTypes.UPDATE,
        transaction,
      },
    );
  } catch (logError) {
    // badge_expiracao_log table may not exist yet; ignore log errors
  }

  return true;
}
