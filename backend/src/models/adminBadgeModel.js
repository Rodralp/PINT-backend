import { QueryTypes, Op } from 'sequelize';
import { sequelize } from '../config/database.js';
import { Badge } from './sql/Badge.js';
import { Tipo } from './sql/Tipo.js';
import { Account } from './sql/Account.js';
import { Nivel } from './sql/Nivel.js';
import { Estado } from './sql/Estado.js';
import { Requisito } from './sql/Requisito.js';
import { BadgeTrigger } from './sql/BadgeTrigger.js';
import { BadgeImagem } from './sql/BadgeImagem.js';
import { PedidoHistorico } from './sql/PedidoHistorico.js';
import { NivelContemBadge } from './sql/NivelContemBadge.js';
import { BadgePertenceArea } from './sql/BadgePertenceArea.js';
import { BadgePertenceSL } from './sql/BadgePertenceSL.js';
import { BadgePertenceLP } from './sql/BadgePertenceLP.js';
import { Pedido } from './sql/Pedido.js';
import { BadgeExpiracaoLog } from './sql/BadgeExpiracaoLog.js';
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

  await BadgeImagem.upsert({
    nbadge: badgeId,
    mime_type: parsed.mimeType,
    dados: binaryBuffer,
  }, { transaction });
};

const loadBadgeImage = async (badgeId, transaction) => {
  const options = transaction ? { transaction } : {};
  const row = await BadgeImagem.findOne({
    where: { nbadge: badgeId },
    attributes: ['mime_type', 'dados'],
    ...options,
    raw: true,
  });

  if (!row?.dados) return null;

  const base64 = Buffer.isBuffer(row.dados)
    ? row.dados.toString('base64')
    : Buffer.from(row.dados).toString('base64');

  return `data:${row.mime_type};base64,${base64}`;
};

const loadBadgeImagesBatch = async (badgeIds, transaction) => {
  if (!badgeIds || badgeIds.length === 0) return {};

  const options = transaction ? { transaction } : {};
  const rows = await BadgeImagem.findAll({
    where: { nbadge: badgeIds },
    attributes: ['nbadge', 'mime_type', 'dados'],
    ...options,
    raw: true,
  });

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
  await BadgeImagem.destroy({
    where: { nbadge: badgeId },
    ...options,
  });
};

const ensureEstadoId = async (estadoNome, transaction) => {
  const options = transaction ? { transaction } : {};
  const [existing] = await Estado.findOrCreate({
    where: { estado: estadoNome },
    defaults: { estado: estadoNome },
    ...options,
  });

  return existing?.nestado;
};

const resolveUtilizadorId = async (accountId) => {
  const parsedAccountId = Number(accountId);
  if (!Number.isInteger(parsedAccountId) || parsedAccountId <= 0) {
    return null;
  }

  const account = await Account.findByPk(parsedAccountId, {
    attributes: ['id'],
  });

  return account?.id || null;
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

const getBadgeTypes = async (transaction) => {
  const options = transaction ? { transaction } : {};
  const rows = await Tipo.findAll({
    attributes: ['ntipo', 'tipo'],
    order: [['ntipo', 'ASC']],
    ...options,
    raw: true,
  });
  return rows;
};

const getTypeNameById = async (typeId, transaction) => {
  const options = transaction ? { transaction } : {};
  const row = await Tipo.findByPk(Number(typeId), {
    attributes: ['tipo'],
    ...options,
    raw: true,
  });

  return row?.tipo || null;
};

const ensureSpecialBadgeTypeId = async (transaction) => {
  const options = transaction ? { transaction } : {};
  const [existing] = await Tipo.findOrCreate({
    where: { tipo: SPECIAL_BADGE_TYPE_NAME },
    defaults: { tipo: SPECIAL_BADGE_TYPE_NAME },
    ...options,
  });

  return existing?.ntipo ? Number(existing.ntipo) : null;
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
  await NivelContemBadge.destroy({
    where: { nbadge: Number(badgeId) },
    transaction,
  });

  await BadgePertenceArea.destroy({
    where: { nbadge: Number(badgeId) },
    transaction,
  });

  await BadgePertenceSL.destroy({
    where: { nbadge: Number(badgeId) },
    transaction,
  });

  await BadgePertenceLP.destroy({
    where: { nbadge: Number(badgeId) },
    transaction,
  });
};

const replaceBadgeTriggers = async (badgeId, requirements, transaction) => {
  await BadgeTrigger.destroy({
    where: { nbadge: Number(badgeId) },
    transaction,
  });

  const normalizedRequirements = normalizeSpecialRequirements(requirements);

  for (const requirement of normalizedRequirements) {
    await BadgeTrigger.create({
      nbadge: Number(badgeId),
      trigger_tipo: requirement.type,
      trigger_valor: requirement.value,
    }, { transaction });
  }
};

const loadBadgeTriggers = async (badgeId, transaction) => {
  const options = transaction ? { transaction } : {};
  const rows = await BadgeTrigger.findAll({
    where: { nbadge: Number(badgeId) },
    attributes: ['trigger_tipo', 'trigger_valor'],
    order: [['trigger_tipo', 'ASC']],
    ...options,
    raw: true,
  });

  return (rows || []).map((row) => ({
    type: row.trigger_tipo,
    value: Number(row.trigger_valor),
  }));
};

const loadBadgeRequirements = async (badgeId, transaction) => {
  const options = transaction ? { transaction } : {};
  const rows = await Requisito.findAll({
    where: { nbadge: Number(badgeId) },
    attributes: ['nreq', 'requisito', 'r_descricao', 'imagem'],
    order: [['nreq', 'ASC']],
    ...options,
    raw: true,
  });

  return (rows || []).map((row) => ({
    id: `req-${Number(row.nreq)}`,
    title: row.requisito || '',
    description: row.r_descricao || '',
    image: row.imagem || null,
  }));
};

const replaceBadgeRequirements = async (badgeId, requirements, transaction) => {
  await Requisito.destroy({
    where: { nbadge: Number(badgeId) },
    transaction,
  });

  const normalizedRequirements = normalizeStandardRequirements(requirements);

  for (const requirement of normalizedRequirements) {
    await Requisito.create({
      requisito: requirement.title,
      r_descricao: requirement.description,
      imagem: requirement.image,
      nbadge: Number(badgeId),
    }, { transaction });
  }
};

const createBadgeAssociations = async (badgeId, levelContext, transaction) => {
  if (!levelContext) {
    return;
  }

  await NivelContemBadge.findOrCreate({
    where: { nnivel: levelContext.levelId, nbadge: Number(badgeId) },
    defaults: { nnivel: levelContext.levelId, nbadge: Number(badgeId) },
    transaction,
  });

  if (levelContext.areaId) {
    await BadgePertenceArea.findOrCreate({
      where: { narea: levelContext.areaId, nbadge: Number(badgeId) },
      defaults: { narea: levelContext.areaId, nbadge: Number(badgeId) },
      transaction,
    });
  }

  if (levelContext.serviceLineId) {
    await BadgePertenceSL.findOrCreate({
      where: { nsline: levelContext.serviceLineId, nbadge: Number(badgeId) },
      defaults: { nsline: levelContext.serviceLineId, nbadge: Number(badgeId) },
      transaction,
    });
  }

  if (levelContext.learningPathId) {
    await BadgePertenceLP.findOrCreate({
      where: { nlpath: levelContext.learningPathId, nbadge: Number(badgeId) },
      defaults: { nlpath: levelContext.learningPathId, nbadge: Number(badgeId) },
      transaction,
    });
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

      const badgeRow = await Badge.create({
        b_nome: name,
        b_descricao: description,
        pontos: safePoints,
        imagem: safeImage,
        ntipo: resolvedTypeId,
        validade: safeValidade,
      }, { transaction, returning: true });

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

      const [updatedRows] = await Badge.update({
        b_nome: name,
        b_descricao: description,
        pontos: safePoints,
        imagem: safeImage,
        ntipo: resolvedTypeId,
        validade: safeValidade,
      }, {
        where: { nbadge: parsedBadgeId },
        returning: true,
        transaction,
      });

      if (!updatedRows) {
        return null;
      }

      const badgeRow = await Badge.findByPk(parsedBadgeId, {
        attributes: ['nbadge', 'b_nome', 'b_descricao', 'pontos', 'imagem', 'ntipo', 'validade'],
        transaction,
        raw: true,
      });

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

    const [badgeRow, specialRequirements, requirementRows] = await Promise.all([
      Badge.findByPk(parsedBadgeId, {
        include: [{
          model: Tipo,
          as: 'tipo',
          attributes: ['tipo'],
        }],
        attributes: ['nbadge', 'b_nome', 'b_descricao', 'pontos', 'imagem', 'ntipo', 'validade'],
        transaction: undefined,
        raw: true,
        nest: true,
      }),
      loadBadgeTriggers(parsedBadgeId),
      loadBadgeRequirements(parsedBadgeId),
    ]);

    if (!badgeRow) {
      return null;
    }

    const levelContext = await fetchBadgeLevelContextByBadgeId(parsedBadgeId);

    const imageFromDb = await loadBadgeImage(parsedBadgeId);
    badgeRow.imagem = imageFromDb || badgeRow.imagem;

    return mapBadgeResponse({
      badgeRow,
      levelContext,
      typeName: badgeRow.tipo?.tipo || badgeRow.tipo,
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

          const [updatedCount] = await Pedido.update(
            {
              estado: rejeitadoId,
              descricao: sequelize.literal(`COALESCE(NULLIF(descricao, ''), 'Candidatura rejeitada automaticamente porque a badge expirou.')`),
            },
            {
              where: {
                nbadge: badgeId,
                [Op.and]: [
                  { estado: { [Op.ne]: rejeitadoId } },
                  { estado: { [Op.ne]: aprovadoId } },
                ],
              },
              transaction,
            },
          );

          totalRejeitados += updatedCount || 0;

          if (updatedCount > 0) {
            await sequelize.query(
              `
                INSERT INTO pedido_historico (npedido, nestado, nutilizador, data_estado, descricao)
                SELECT npedido, :rejeitadoId, NULL, NOW(), 'Candidatura rejeitada automaticamente porque a badge expirou.'
                FROM pedidos
                WHERE nbadge = :badgeId
                  AND estado = :rejeitadoId
              `,
              {
                replacements: { rejeitadoId, badgeId },
                type: QueryTypes.INSERT,
                transaction,
              },
            );
          }

          try {
            await BadgeExpiracaoLog.findOrCreate({
              where: { nbadge: badgeId, data_expiracao: badge.validade },
              defaults: {
                nbadge: badgeId,
                data_expiracao: badge.validade,
                pedidos_rejeitados: updatedCount || 0,
              },
              transaction,
            });
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
  const nivelAssociation = await NivelContemBadge.findOne({
    where: { nbadge: badgeId },
    attributes: ['nnivel'],
    transaction,
    raw: true,
  });

  if (!nivelAssociation) {
    return false;
  }

  const nivelId = nivelAssociation.nnivel;

  const [activeResult] = await sequelize.query(
    `
      SELECT COUNT(*)::int AS cnt
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

  if (activeResult?.cnt > 0) {
    return false;
  }

  await Nivel.update(
    { is_active: false },
    { where: { nnivel: nivelId }, transaction },
  );

  try {
    await BadgeExpiracaoLog.update(
      { nivel_desativado: true },
      {
        where: {
          nbadge: badgeId,
          nivel_desativado: false,
        },
        transaction,
      },
    );
  } catch (logError) {
    // badge_expiracao_log table may not exist yet; ignore log errors
  }

  return true;
}
