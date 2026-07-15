import { QueryTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

const parsePositiveId = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export const getBadgeAssignmentReport = async (filters = {}) => {
  const { areaId, dateFrom, dateTo, nivelId, serviceLineId } = filters;

  const conditions = [];
  const replacements = {};

  if (areaId && typeof areaId === 'string' && areaId.trim() && nivelId?.trim()?.toLowerCase() !== 'especial') {
    conditions.push('a.area = :areaId');
    replacements.areaId = areaId.trim();
  }

  if (nivelId && typeof nivelId === 'string' && nivelId.trim()) {
    if (nivelId.trim().toLowerCase() === 'especial') {
      conditions.push("LOWER(t.tipo) = 'especial'");
    } else {
      conditions.push("t.level_key LIKE CONCAT('%', :nivelId, '%')");
      replacements.nivelId = nivelId.trim();
    }
  }

  if (parsePositiveId(serviceLineId)) {
    conditions.push('sl.nsline = :serviceLineId');
    replacements.serviceLineId = parsePositiveId(serviceLineId);
  }

  if (dateFrom) {
    conditions.push('cob.data_obtencao >= :dateFrom');
    replacements.dateFrom = dateFrom;
  }

  if (dateTo) {
    conditions.push('cob.data_obtencao <= :dateTo');
    replacements.dateTo = dateTo;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = await sequelize.query(
    `
      SELECT
        u.nutilizador AS "consultorId",
        u.nome AS "consultorNome",
        u.email AS "consultorEmail",
        b.nbadge AS "badgeId",
        b.b_nome AS "badgeNome",
        b.pontos AS "badgePontos",
        t.tipo AS "nivelNome",
        a.area AS "areaNome",
        sl.sline AS "serviceLineNome",
        cob.data_obtencao AS "dataObtencao",
        cob.pontos_obtidos AS "pontosObtidos"
      FROM c_obtem_b cob
      INNER JOIN utilizador u ON u.nutilizador = cob.nutilizador
      INNER JOIN badge b ON b.nbadge = cob.nbadge
      INNER JOIN tipo t ON t.ntipo = b.ntipo
      LEFT JOIN nivel_contem_b ncb ON ncb.nbadge = b.nbadge
      LEFT JOIN nivel n ON n.nnivel = ncb.nnivel
      LEFT JOIN area a ON a.narea = n.narea
      LEFT JOIN service_line sl ON sl.nsline = a.nsline
      ${whereClause}
      ORDER BY a.area ASC, u.nome ASC, cob.data_obtencao DESC
    `,
    {
      replacements,
      type: QueryTypes.SELECT,
    },
  );

  return rows;
};
