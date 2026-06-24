import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const parsePositiveId = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const pendingEstadoNames = ['pendente-tm', 'pendente-sll'];
const activeEstadoNames = [...pendingEstadoNames, 'aprovado'];

const normalizeLevelTitle = (value) => {
  const raw = String(value || '').trim();
  if (!raw) {
    return '-';
  }

  if (raw.includes(' - ')) {
    const suffix = raw.split(' - ').slice(1).join(' - ').trim();
    if (suffix) {
      return suffix;
    }
  }

  return raw.replace(/^nivel\s+/i, '').trim() || raw;
};

const mapWorkflowStatusToUi = (statusValue) => {
  const normalized = String(statusValue || '').trim().toLowerCase();

  if (pendingEstadoNames.includes(normalized)) {
    return 'pendente';
  }

  if (normalized === 'aprovado') {
    return 'completo';
  }

  if (normalized === 'rejeitado' || normalized === 'evidencias_insuficientes') {
    return 'rejeitado';
  }

  return normalized || 'pendente';
};

// Histórico - Todas as Service Lines
export const getHistoricoServiceLines = async (req, res) => {
  const accountId = parsePositiveId(req.query?.accountId);

  if (!accountId) {
    res.status(400).json({ message: 'Account id is required.' });
    return;
  }

  try {
    const rows = await sequelize.query(
      `
        WITH obtidos_badges AS (
          SELECT DISTINCT
            bps.nsline,
            cb.nbadge
          FROM c_obtem_b cb
          INNER JOIN b_pertence_sl bps
            ON bps.nbadge = cb.nbadge
        ),
        pending_badges AS (
          SELECT DISTINCT
            bps.nsline,
            p.nbadge
          FROM pedidos p
          INNER JOIN estado e
            ON e.nestado = p.estado
          INNER JOIN b_pertence_sl bps
            ON bps.nbadge = p.nbadge
          WHERE LOWER(COALESCE(e.estado, '')) IN (:pendingEstadoNames)
        ),
        consultores_por_sl AS (
          SELECT DISTINCT
            bps.nsline,
            cb.nutilizador
          FROM c_obtem_b cb
          INNER JOIN b_pertence_sl bps
            ON bps.nbadge = cb.nbadge
          UNION
          SELECT DISTINCT
            bps.nsline,
            p.nutilizador
          FROM pedidos p
          INNER JOIN estado e
            ON e.nestado = p.estado
          INNER JOIN b_pertence_sl bps
            ON bps.nbadge = p.nbadge
          WHERE LOWER(COALESCE(e.estado, '')) IN (:activeEstadoNames)
        )
        SELECT
          sl.nsline AS id,
          sl.sline AS name,
          COUNT(DISTINCT bps.nbadge) AS "totalBadges",
          COUNT(DISTINCT ob.nbadge) AS obtidas,
          COUNT(DISTINCT pb.nbadge) AS "emProgresso",
          COUNT(DISTINCT u.nutilizador) AS "totalConsultores"
        FROM service_line sl
        LEFT JOIN b_pertence_sl bps
          ON bps.nsline = sl.nsline
        LEFT JOIN obtidos_badges ob
          ON ob.nsline = sl.nsline
         AND ob.nbadge = bps.nbadge
        LEFT JOIN pending_badges pb
          ON pb.nsline = sl.nsline
         AND pb.nbadge = bps.nbadge
        LEFT JOIN consultores_por_sl cps
          ON cps.nsline = sl.nsline
        LEFT JOIN utilizador u
          ON u.nutilizador = cps.nutilizador
         AND LOWER(COALESCE(u.permissoes, '')) LIKE '%consultor%'
        GROUP BY sl.nsline, sl.sline
        ORDER BY sl.sline ASC
      `,
      {
        replacements: { pendingEstadoNames, activeEstadoNames },
        type: QueryTypes.SELECT,
      },
    );

    res.status(200).json(rows);
  } catch (error) {
    res.status(500).json({ message: error?.message || 'Failed to fetch service lines.' });
  }
};

// Histórico - Todos os Badges
export const getHistoricoBadges = async (req, res) => {
  const accountId = parsePositiveId(req.query?.accountId);

  if (!accountId) {
    res.status(400).json({ message: 'Account id is required.' });
    return;
  }

  try {
    const rows = await sequelize.query(
      `
        WITH obtidos_counts AS (
          SELECT
            cb.nbadge,
            COUNT(DISTINCT cb.nutilizador) AS consultores_obtidos
          FROM c_obtem_b cb
          GROUP BY cb.nbadge
        ),
        pending_counts AS (
          SELECT
            p.nbadge,
            COUNT(DISTINCT p.nutilizador) AS em_progresso
          FROM pedidos p
          INNER JOIN estado e
            ON e.nestado = p.estado
          WHERE LOWER(COALESCE(e.estado, '')) IN (:pendingEstadoNames)
          GROUP BY p.nbadge
        )
        SELECT
          b.nbadge AS id,
          b.b_nome AS name,
          lvl.area,
          COALESCE(lvl.service_line_name, slmeta.service_line_name, '-') AS "serviceLine",
          lvl.nivel AS level,
          COALESCE(oc.consultores_obtidos, 0) AS "consultoresObtidos",
          COALESCE(pc.em_progresso, 0) AS "emProgresso",
          CASE
            WHEN COALESCE(oc.consultores_obtidos, 0) > 0 THEN 'completo'
            WHEN COALESCE(pc.em_progresso, 0) > 0 THEN 'a-fazer'
            ELSE 'a-fazer'
          END AS status
        FROM badge b
        LEFT JOIN LATERAL (
          SELECT
            a.area,
            sl.sline AS service_line_name,
            n.nivel
          FROM nivel_contem_b ncb
          LEFT JOIN nivel n
            ON n.nnivel = ncb.nnivel
          LEFT JOIN area a
            ON a.narea = n.narea
          LEFT JOIN service_line sl
            ON sl.nsline = a.nsline
          WHERE ncb.nbadge = b.nbadge
          ORDER BY n.nnivel ASC
          LIMIT 1
        ) lvl
          ON TRUE
        LEFT JOIN LATERAL (
          SELECT sl.sline AS service_line_name
          FROM b_pertence_sl bps
          INNER JOIN service_line sl
            ON sl.nsline = bps.nsline
          WHERE bps.nbadge = b.nbadge
          ORDER BY sl.sline ASC
          LIMIT 1
        ) slmeta
          ON TRUE
        LEFT JOIN obtidos_counts oc
          ON oc.nbadge = b.nbadge
        LEFT JOIN pending_counts pc
          ON pc.nbadge = b.nbadge
        ORDER BY b.b_nome ASC
      `,
      {
        replacements: { pendingEstadoNames },
        type: QueryTypes.SELECT,
      },
    );

    const normalizedRows = rows.map((row) => ({
      ...row,
      level: normalizeLevelTitle(row.level),
    }));

    res.status(200).json(normalizedRows);
  } catch (error) {
    res.status(500).json({ message: error?.message || 'Failed to fetch badges.' });
  }
};

// Histórico - Todos os Consultores
export const getHistoricoConsultores = async (req, res) => {
  const accountId = parsePositiveId(req.query?.accountId);

  if (!accountId) {
    res.status(400).json({ message: 'Account id is required.' });
    return;
  }

  try {
    const rows = await sequelize.query(
      `
        WITH points_badges AS (
          SELECT
            cb.nutilizador,
            SUM(COALESCE(NULLIF(cb.pontos_obtidos, 0), NULLIF(b.pontos, 0), 0)) AS points,
            COUNT(DISTINCT cb.nbadge) AS badges_obtidas
          FROM c_obtem_b cb
          INNER JOIN badge b
            ON b.nbadge = cb.nbadge
          GROUP BY cb.nutilizador
        ),
        progress_badges AS (
          SELECT
            p.nutilizador,
            COUNT(DISTINCT p.nbadge) AS badges_em_progresso
          FROM pedidos p
          INNER JOIN estado e
            ON e.nestado = p.estado
          WHERE LOWER(COALESCE(e.estado, '')) IN (:pendingEstadoNames)
          GROUP BY p.nutilizador
        ),
        service_line_scores AS (
          SELECT
            cb.nutilizador,
            sl.sline,
            SUM(COALESCE(NULLIF(cb.pontos_obtidos, 0), NULLIF(b.pontos, 0), 0)) AS points
          FROM c_obtem_b cb
          INNER JOIN badge b
            ON b.nbadge = cb.nbadge
          LEFT JOIN b_pertence_sl bps
            ON bps.nbadge = b.nbadge
          LEFT JOIN service_line sl
            ON sl.nsline = bps.nsline
          GROUP BY cb.nutilizador, sl.sline
        ),
        dominant_service_line AS (
          SELECT DISTINCT ON (nutilizador)
            nutilizador,
            sline
          FROM service_line_scores
          ORDER BY nutilizador, points DESC, sline ASC
        )
        SELECT
          u.nutilizador AS id,
          u.nome AS name,
          u.email,
          COALESCE(pb.points, 0) AS points,
          COALESCE(pb.badges_obtidas, 0) AS "badgesObtidas",
          COALESCE(pr.badges_em_progresso, 0) AS "badgesEmProgresso",
          COALESCE(dsl.sline, '-') AS "serviceLine",
          COALESCE(DATE(u.data_registo), CURRENT_DATE) AS "joinedAt",
          CASE
            WHEN LOWER(COALESCE(u.status, '')) IN ('ativo', 'inativo', 'pendente') THEN LOWER(u.status)
            ELSE 'inativo'
          END AS status
        FROM utilizador u
        LEFT JOIN points_badges pb
          ON pb.nutilizador = u.nutilizador
        LEFT JOIN progress_badges pr
          ON pr.nutilizador = u.nutilizador
        LEFT JOIN dominant_service_line dsl
          ON dsl.nutilizador = u.nutilizador
        WHERE LOWER(COALESCE(u.permissoes, '')) LIKE '%consultor%'
        ORDER BY u.nome ASC
      `,
      {
        replacements: { pendingEstadoNames },
        type: QueryTypes.SELECT,
      },
    );

    const consultores = (Array.isArray(rows) ? rows : []).map((row) => ({
      ...row,
      avatar: null,
    }));

    const avatarIds = consultores.map((c) => c.id).filter(Boolean);
    if (avatarIds.length > 0) {
      try {
        const { utilizadorImagemModel } = await import('../models/utilizadorImagemModel.js');
        const avatarMap = await utilizadorImagemModel.loadUserImagesBatch(avatarIds);
        for (const c of consultores) {
          if (avatarMap[c.id]) c.avatar = avatarMap[c.id];
        }
      } catch { /* no images */ }
    }

    res.status(200).json(consultores);
  } catch (error) {
    res.status(500).json({ message: error?.message || 'Failed to fetch consultores.' });
  }
};

// Detalhes - Histórico de badges de um consultor específico
export const getDetalhesConsultorTM = async (req, res) => {
  const consultorId = parsePositiveId(req.query?.consultorId);

  if (!consultorId) {
    res.status(400).json({ message: 'Consultor id is required.' });
    return;
  }

  try {
    const [consultor] = await sequelize.query(
      `
        SELECT
          u.nutilizador AS id,
          u.nome AS name,
          u.email,
          CASE
            WHEN LOWER(COALESCE(u.status, '')) IN ('ativo', 'inativo', 'pendente') THEN LOWER(u.status)
            ELSE 'inativo'
          END AS status,
          COALESCE(points_sum.total_points, 0) AS "totalPoints"
        FROM utilizador u
        LEFT JOIN (
          SELECT
            cb.nutilizador,
            SUM(COALESCE(NULLIF(cb.pontos_obtidos, 0), NULLIF(b.pontos, 0), 0)) AS total_points
          FROM c_obtem_b cb
          INNER JOIN badge b
            ON b.nbadge = cb.nbadge
          WHERE cb.nutilizador = :consultorId
          GROUP BY cb.nutilizador
        ) points_sum
          ON points_sum.nutilizador = u.nutilizador
        WHERE u.nutilizador = :consultorId
          AND LOWER(COALESCE(u.permissoes, '')) LIKE '%consultor%'
        LIMIT 1
      `,
      {
        replacements: { consultorId },
        type: QueryTypes.SELECT,
      },
    );

    if (!consultor) {
      res.status(404).json({ message: 'Consultor not found.' });
      return;
    }

    const badgesObtidos = await sequelize.query(
      `
        SELECT
          cb.nbadge AS id,
          b.b_nome AS name,
          lvl.area AS "areaName",
          COALESCE(lvl.service_line_name, slmeta.service_line_name, '-') AS "serviceLineName",
          cb.data_obtencao AS "obtainedDate",
          COALESCE(NULLIF(cb.pontos_obtidos, 0), NULLIF(b.pontos, 0), 0) AS points
        FROM c_obtem_b cb
        INNER JOIN badge b
          ON b.nbadge = cb.nbadge
        LEFT JOIN LATERAL (
          SELECT
            a.area,
            sl.sline AS service_line_name
          FROM nivel_contem_b ncb
          LEFT JOIN nivel n
            ON n.nnivel = ncb.nnivel
          LEFT JOIN area a
            ON a.narea = n.narea
          LEFT JOIN service_line sl
            ON sl.nsline = a.nsline
          WHERE ncb.nbadge = b.nbadge
          ORDER BY n.nnivel ASC
          LIMIT 1
        ) lvl
          ON TRUE
        LEFT JOIN LATERAL (
          SELECT sl.sline AS service_line_name
          FROM b_pertence_sl bps
          INNER JOIN service_line sl
            ON sl.nsline = bps.nsline
          WHERE bps.nbadge = b.nbadge
          ORDER BY sl.sline ASC
          LIMIT 1
        ) slmeta
          ON TRUE
        WHERE cb.nutilizador = :consultorId
        ORDER BY cb.data_obtencao DESC, cb.nbadge DESC
      `,
      {
        replacements: { consultorId },
        type: QueryTypes.SELECT,
      },
    );

    const rawBadgesEmProgresso = await sequelize.query(
      `
        SELECT DISTINCT ON (p.nbadge)
          p.nbadge AS id,
          b.b_nome AS name,
          lvl.area AS "areaName",
          COALESCE(lvl.service_line_name, slmeta.service_line_name, '-') AS "serviceLineName",
          LOWER(COALESCE(e.estado, '')) AS workflow_status,
          p.data_submissao AS "requestDate"
        FROM pedidos p
        INNER JOIN badge b
          ON b.nbadge = p.nbadge
        INNER JOIN estado e
          ON e.nestado = p.estado
        LEFT JOIN LATERAL (
          SELECT
            a.area,
            sl.sline AS service_line_name
          FROM nivel_contem_b ncb
          LEFT JOIN nivel n
            ON n.nnivel = ncb.nnivel
          LEFT JOIN area a
            ON a.narea = n.narea
          LEFT JOIN service_line sl
            ON sl.nsline = a.nsline
          WHERE ncb.nbadge = b.nbadge
          ORDER BY n.nnivel ASC
          LIMIT 1
        ) lvl
          ON TRUE
        LEFT JOIN LATERAL (
          SELECT sl.sline AS service_line_name
          FROM b_pertence_sl bps
          INNER JOIN service_line sl
            ON sl.nsline = bps.nsline
          WHERE bps.nbadge = b.nbadge
          ORDER BY sl.sline ASC
          LIMIT 1
        ) slmeta
          ON TRUE
        WHERE p.nutilizador = :consultorId
          AND LOWER(COALESCE(e.estado, '')) IN (:pendingEstadoNames)
        ORDER BY p.nbadge, p.data_submissao DESC, p.npedido DESC
      `,
      {
        replacements: { consultorId, pendingEstadoNames },
        type: QueryTypes.SELECT,
      },
    );

    const badgesEmProgresso = rawBadgesEmProgresso.map((badge) => ({
      ...badge,
      status: mapWorkflowStatusToUi(badge.workflow_status),
    }));

    res.status(200).json({
      consultor,
      badgesObtidos: badgesObtidos || [],
      badgesEmProgresso: badgesEmProgresso || [],
    });
  } catch (error) {
    res.status(500).json({ message: error?.message || 'Failed to fetch consultor details.' });
  }
};

// Detalhes - Histórico de um badge específico
export const getDetalhesBadgeTM = async (req, res) => {
  const badgeId = parsePositiveId(req.query?.badgeId);

  if (!badgeId) {
    res.status(400).json({ message: 'Badge id is required.' });
    return;
  }

  try {
    const [badge] = await sequelize.query(
      `
        SELECT
          b.nbadge AS id,
          b.b_nome AS name,
          lvl.area AS "areaName",
          COALESCE(lvl.service_line_name, slmeta.service_line_name, '-') AS "serviceLineName",
          lvl.nivel AS level,
          COALESCE(NULLIF(b.pontos, 0), 0) AS points
        FROM badge b
        LEFT JOIN LATERAL (
          SELECT
            a.area,
            sl.sline AS service_line_name,
            n.nivel
          FROM nivel_contem_b ncb
          LEFT JOIN nivel n
            ON n.nnivel = ncb.nnivel
          LEFT JOIN area a
            ON a.narea = n.narea
          LEFT JOIN service_line sl
            ON sl.nsline = a.nsline
          WHERE ncb.nbadge = b.nbadge
          ORDER BY n.nnivel ASC
          LIMIT 1
        ) lvl
          ON TRUE
        LEFT JOIN LATERAL (
          SELECT sl.sline AS service_line_name
          FROM b_pertence_sl bps
          INNER JOIN service_line sl
            ON sl.nsline = bps.nsline
          WHERE bps.nbadge = b.nbadge
          ORDER BY sl.sline ASC
          LIMIT 1
        ) slmeta
          ON TRUE
        WHERE b.nbadge = :badgeId
        LIMIT 1
      `,
      {
        replacements: { badgeId },
        type: QueryTypes.SELECT,
      },
    );

    if (!badge) {
      res.status(404).json({ message: 'Badge not found.' });
      return;
    }

    const consultoresObtidos = await sequelize.query(
      `
        SELECT
          u.nutilizador AS id,
          u.nome AS name,
          u.email,
          COALESCE(lvl.service_line_name, slmeta.service_line_name, '-') AS "serviceLineName",
          cb.data_obtencao AS "obtainedDate"
        FROM c_obtem_b cb
        INNER JOIN utilizador u
          ON u.nutilizador = cb.nutilizador
        INNER JOIN badge b
          ON b.nbadge = cb.nbadge
        LEFT JOIN LATERAL (
          SELECT sl.sline AS service_line_name
          FROM b_pertence_sl bps
          INNER JOIN service_line sl
            ON sl.nsline = bps.nsline
          WHERE bps.nbadge = b.nbadge
          ORDER BY sl.sline ASC
          LIMIT 1
        ) slmeta
          ON TRUE
        LEFT JOIN LATERAL (
          SELECT sl.sline AS service_line_name
          FROM nivel_contem_b ncb
          LEFT JOIN nivel n
            ON n.nnivel = ncb.nnivel
          LEFT JOIN area a
            ON a.narea = n.narea
          LEFT JOIN service_line sl
            ON sl.nsline = a.nsline
          WHERE ncb.nbadge = b.nbadge
          ORDER BY n.nnivel ASC
          LIMIT 1
        ) lvl
          ON TRUE
        WHERE cb.nbadge = :badgeId
          AND LOWER(COALESCE(u.permissoes, '')) LIKE '%consultor%'
        ORDER BY cb.data_obtencao DESC, u.nome ASC
      `,
      {
        replacements: { badgeId },
        type: QueryTypes.SELECT,
      },
    );

    const rawConsultoresEmProgresso = await sequelize.query(
      `
        SELECT DISTINCT ON (p.nutilizador)
          u.nutilizador AS id,
          u.nome AS name,
          u.email,
          COALESCE(lvl.service_line_name, slmeta.service_line_name, '-') AS "serviceLineName",
          p.data_submissao AS "requestDate",
          LOWER(COALESCE(e.estado, '')) AS workflow_status
        FROM pedidos p
        INNER JOIN utilizador u
          ON u.nutilizador = p.nutilizador
        INNER JOIN badge b
          ON b.nbadge = p.nbadge
        INNER JOIN estado e
          ON e.nestado = p.estado
        LEFT JOIN LATERAL (
          SELECT sl.sline AS service_line_name
          FROM b_pertence_sl bps
          INNER JOIN service_line sl
            ON sl.nsline = bps.nsline
          WHERE bps.nbadge = b.nbadge
          ORDER BY sl.sline ASC
          LIMIT 1
        ) slmeta
          ON TRUE
        LEFT JOIN LATERAL (
          SELECT sl.sline AS service_line_name
          FROM nivel_contem_b ncb
          LEFT JOIN nivel n
            ON n.nnivel = ncb.nnivel
          LEFT JOIN area a
            ON a.narea = n.narea
          LEFT JOIN service_line sl
            ON sl.nsline = a.nsline
          WHERE ncb.nbadge = b.nbadge
          ORDER BY n.nnivel ASC
          LIMIT 1
        ) lvl
          ON TRUE
        WHERE p.nbadge = :badgeId
          AND LOWER(COALESCE(e.estado, '')) IN (:pendingEstadoNames)
          AND LOWER(COALESCE(u.permissoes, '')) LIKE '%consultor%'
        ORDER BY p.nutilizador, p.data_submissao DESC, p.npedido DESC
      `,
      {
        replacements: { badgeId, pendingEstadoNames },
        type: QueryTypes.SELECT,
      },
    );

    const consultoresEmProgresso = rawConsultoresEmProgresso.map((consultor) => ({
      ...consultor,
      status: mapWorkflowStatusToUi(consultor.workflow_status),
    }));

    res.status(200).json({
      badge: {
        ...badge,
        level: normalizeLevelTitle(badge.level),
      },
      consultoresObtidos: consultoresObtidos || [],
      consultoresEmProgresso: consultoresEmProgresso || [],
      totalObtidos: consultoresObtidos?.length || 0,
      totalEmProgresso: consultoresEmProgresso?.length || 0,
    });
  } catch (error) {
    res.status(500).json({ message: error?.message || 'Failed to fetch badge details.' });
  }
};

// Detalhes - Histórico de uma service line específica
export const getDetalhesServiceLineTM = async (req, res) => {
  const serviceLineId = parsePositiveId(req.query?.serviceLineId);

  if (!serviceLineId) {
    res.status(400).json({ message: 'Service line id is required.' });
    return;
  }

  try {
    const [serviceLine] = await sequelize.query(
      `
        WITH sl_badges AS (
          SELECT bps.nbadge
          FROM b_pertence_sl bps
          WHERE bps.nsline = :serviceLineId
        )
        SELECT
          sl.nsline AS id,
          sl.sline AS name,
          COALESCE((
            SELECT COUNT(DISTINCT sb.nbadge)
            FROM sl_badges sb
          ), 0) AS "totalBadges",
          COALESCE((
            SELECT COUNT(DISTINCT cb.nbadge)
            FROM c_obtem_b cb
            INNER JOIN sl_badges sb
              ON sb.nbadge = cb.nbadge
          ), 0) AS obtidas,
          COALESCE((
            SELECT COUNT(DISTINCT p.nbadge)
            FROM pedidos p
            INNER JOIN estado e
              ON e.nestado = p.estado
            INNER JOIN sl_badges sb
              ON sb.nbadge = p.nbadge
            WHERE LOWER(COALESCE(e.estado, '')) IN (:pendingEstadoNames)
          ), 0) AS "emProgresso",
          COALESCE((
            SELECT COUNT(DISTINCT origin.nutilizador)
            FROM (
              SELECT cb.nutilizador
              FROM c_obtem_b cb
              INNER JOIN sl_badges sb
                ON sb.nbadge = cb.nbadge
              UNION
              SELECT p.nutilizador
              FROM pedidos p
              INNER JOIN estado e
                ON e.nestado = p.estado
              INNER JOIN sl_badges sb
                ON sb.nbadge = p.nbadge
              WHERE LOWER(COALESCE(e.estado, '')) IN (:activeEstadoNames)
            ) origin
            INNER JOIN utilizador u
              ON u.nutilizador = origin.nutilizador
            WHERE LOWER(COALESCE(u.permissoes, '')) LIKE '%consultor%'
          ), 0) AS "totalConsultores"
        FROM service_line sl
        WHERE sl.nsline = :serviceLineId
        LIMIT 1
      `,
      {
        replacements: { serviceLineId, pendingEstadoNames, activeEstadoNames },
        type: QueryTypes.SELECT,
      },
    );

    if (!serviceLine) {
      res.status(404).json({ message: 'Service line not found.' });
      return;
    }

    const areas = await sequelize.query(
      `
        WITH sl_badges AS (
          SELECT bps.nbadge
          FROM b_pertence_sl bps
          WHERE bps.nsline = :serviceLineId
        ),
        pending_badges AS (
          SELECT DISTINCT p.nbadge
          FROM pedidos p
          INNER JOIN estado e
            ON e.nestado = p.estado
          INNER JOIN sl_badges sb
            ON sb.nbadge = p.nbadge
          WHERE LOWER(COALESCE(e.estado, '')) IN (:pendingEstadoNames)
        )
        SELECT
          a.narea AS id,
          a.area AS name,
          COUNT(DISTINCT CASE WHEN sb.nbadge IS NOT NULL THEN bpa.nbadge END) AS "totalBadges",
          COUNT(DISTINCT CASE WHEN sb.nbadge IS NOT NULL AND cb.nbadge IS NOT NULL THEN bpa.nbadge END) AS obtidas,
          COUNT(DISTINCT CASE WHEN sb.nbadge IS NOT NULL AND pb.nbadge IS NOT NULL THEN bpa.nbadge END) AS "emProgresso"
        FROM area a
        LEFT JOIN b_pertence_a bpa
          ON bpa.narea = a.narea
        LEFT JOIN sl_badges sb
          ON sb.nbadge = bpa.nbadge
        LEFT JOIN c_obtem_b cb
          ON cb.nbadge = bpa.nbadge
        LEFT JOIN pending_badges pb
          ON pb.nbadge = bpa.nbadge
        WHERE a.nsline = :serviceLineId
        GROUP BY a.narea, a.area
        ORDER BY a.area ASC
      `,
      {
        replacements: { serviceLineId, pendingEstadoNames },
        type: QueryTypes.SELECT,
      },
    );

    const consultores = await sequelize.query(
      `
        WITH sl_badges AS (
          SELECT bps.nbadge
          FROM b_pertence_sl bps
          WHERE bps.nsline = :serviceLineId
        ),
        consultores_na_sl AS (
          SELECT cb.nutilizador
          FROM c_obtem_b cb
          INNER JOIN sl_badges sb
            ON sb.nbadge = cb.nbadge
          UNION
          SELECT p.nutilizador
          FROM pedidos p
          INNER JOIN sl_badges sb
            ON sb.nbadge = p.nbadge
        ),
        points_badges AS (
          SELECT
            cb.nutilizador,
            SUM(COALESCE(NULLIF(cb.pontos_obtidos, 0), NULLIF(b.pontos, 0), 0)) AS points,
            COUNT(DISTINCT cb.nbadge) AS badges_obtidas
          FROM c_obtem_b cb
          INNER JOIN badge b
            ON b.nbadge = cb.nbadge
          INNER JOIN sl_badges sb
            ON sb.nbadge = cb.nbadge
          GROUP BY cb.nutilizador
        ),
        progress_badges AS (
          SELECT
            p.nutilizador,
            COUNT(DISTINCT p.nbadge) AS badges_em_progresso
          FROM pedidos p
          INNER JOIN estado e
            ON e.nestado = p.estado
          INNER JOIN sl_badges sb
            ON sb.nbadge = p.nbadge
          WHERE LOWER(COALESCE(e.estado, '')) IN (:pendingEstadoNames)
          GROUP BY p.nutilizador
        )
        SELECT
          u.nutilizador AS id,
          u.nome AS name,
          u.email,
          COALESCE(pb.points, 0) AS points,
          COALESCE(pb.badges_obtidas, 0) AS "badgesObtidas",
          COALESCE(pr.badges_em_progresso, 0) AS "badgesEmProgresso",
          CASE
            WHEN LOWER(COALESCE(u.status, '')) IN ('ativo', 'inativo', 'pendente') THEN LOWER(u.status)
            ELSE 'inativo'
          END AS status
        FROM consultores_na_sl csl
        INNER JOIN utilizador u
          ON u.nutilizador = csl.nutilizador
        LEFT JOIN points_badges pb
          ON pb.nutilizador = u.nutilizador
        LEFT JOIN progress_badges pr
          ON pr.nutilizador = u.nutilizador
        WHERE LOWER(COALESCE(u.permissoes, '')) LIKE '%consultor%'
        ORDER BY u.nome ASC
      `,
      {
        replacements: { serviceLineId, pendingEstadoNames },
        type: QueryTypes.SELECT,
      },
    );

    res.status(200).json({
      serviceLine,
      areas: areas || [],
      consultores: consultores || [],
    });
  } catch (error) {
    res.status(500).json({ message: error?.message || 'Failed to fetch service line details.' });
  }
};
