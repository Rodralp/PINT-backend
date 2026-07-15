import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/database.js';
import { serviceLineLeaderService } from '../services/serviceLineLeaderService.js';

const parseAccountId = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const pendingEstadoNames = ['pendente-tm', 'pendente-sll'];
const activeEstadoNames = [...pendingEstadoNames, 'aprovado'];

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

const getUtilizadorIdByAccountId = async (accountId) => {
  const [row] = await sequelize.query(
    `SELECT nutilizador FROM utilizador WHERE nutilizador = :accountId LIMIT 1`,
    {
      replacements: { accountId: Number(accountId) },
      type: QueryTypes.SELECT,
    }
  );
  return row ? Number(row.nutilizador) : null;
};

const getServiceLineForLeader = async (accountId) => {
  const utilizadorId = await getUtilizadorIdByAccountId(accountId);
  if (!utilizadorId) return null;

  const [row] = await sequelize.query(
    `
      SELECT sl.nsline, sl.sline
      FROM sll_leader_sl sll
      INNER JOIN service_line sl
        ON sl.nsline = sll.nsline
      WHERE sll.nutilizador = :utilizadorId
      ORDER BY sl.nsline ASC
      LIMIT 1
    `,
    {
      replacements: { utilizadorId },
      type: QueryTypes.SELECT,
    },
  );

  return row || null;
};

// Minha Service Line - Página principal
export const getMyServiceLine = async (req, res) => {
  const accountId = parseAccountId(req.query?.accountId);

  if (!accountId) {
    res.status(400).json({ message: 'Account id is required.' });
    return;
  }

  try {
    const data = await serviceLineLeaderService.getMyServiceLine(accountId);
    res.status(200).json(data || []);
  } catch (error) {
    res.status(500).json({ message: error?.message || 'Failed to fetch service line data.' });
  }
};

// Ranking - Consultores da Service Line do SLL
export const getRankingConsultoresSLL = async (req, res) => {
  const accountId = parseAccountId(req.query?.accountId);

  if (!accountId) {
    res.status(400).json({ message: 'Account id is required.' });
    return;
  }

  try {
    const serviceLine = await getServiceLineForLeader(accountId);

    if (!serviceLine) {
      res.status(404).json({ message: 'Service Line Leader not found.' });
      return;
    }

    const serviceLineId = Number(serviceLine.nsline);
    const serviceLineName = serviceLine.sline || 'Service Line';

    const rows = await sequelize.query(
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
            COUNT(DISTINCT cb.nbadge) AS badges
          FROM c_obtem_b cb
          INNER JOIN badge b
            ON b.nbadge = cb.nbadge
          INNER JOIN sl_badges sb
            ON sb.nbadge = cb.nbadge
          GROUP BY cb.nutilizador
        )
        SELECT
          u.nutilizador AS id,
          u.nome AS name,
          u.email,
          COALESCE(pb.points, 0) AS points,
          COALESCE(pb.badges, 0) AS badges,
          :serviceLineName AS "serviceLine"
        FROM consultores_na_sl csl
        INNER JOIN utilizador u
          ON u.nutilizador = csl.nutilizador
        LEFT JOIN points_badges pb
          ON pb.nutilizador = u.nutilizador
        WHERE LOWER(COALESCE(u.permissoes, '')) LIKE '%consultor%'
        ORDER BY points DESC, badges DESC, u.nome ASC
      `,
      {
        replacements: { serviceLineId, serviceLineName },
        type: QueryTypes.SELECT,
      },
    );

    const consultores = (Array.isArray(rows) ? rows : []).map((row) => ({
      id: Number(row.id),
      name: row.name || 'Consultor',
      email: row.email || '',
      points: Number(row.points) || 0,
      badges: Number(row.badges) || 0,
      serviceLine: row.serviceLine || 'Service Line',
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
    res.status(500).json({ message: error?.message || 'Failed to fetch ranking.' });
  }
};

// Histórico - Áreas da Service Line (tabela por áreas)
export const getHistoricoAreasSLL = async (req, res) => {
  const accountId = parseAccountId(req.query?.accountId);

  if (!accountId) {
    res.status(400).json({ message: 'Account id is required.' });
    return;
  }

  try {
    const serviceLine = await getServiceLineForLeader(accountId);

    if (!serviceLine) {
      res.status(404).json({ message: 'Service Line Leader not found.' });
      return;
    }

    const serviceLineId = Number(serviceLine.nsline);

    const [serviceLineData] = await sequelize.query(
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
        replacements: {
          serviceLineId,
          pendingEstadoNames,
          activeEstadoNames,
        },
        type: QueryTypes.SELECT,
      },
    );

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

    res.status(200).json({
      serviceLine: serviceLineData || null,
      areas: areas || [],
    });
  } catch (error) {
    res.status(500).json({ message: error?.message || 'Failed to fetch areas.' });
  }
};

// Histórico - Badges da Service Line do SLL
export const getHistoricoBadgesSLL = async (req, res) => {
  const accountId = parseAccountId(req.query?.accountId);

  if (!accountId) {
    res.status(400).json({ message: 'Account id is required.' });
    return;
  }

  try {
    const serviceLine = await getServiceLineForLeader(accountId);

    if (!serviceLine) {
      res.status(404).json({ message: 'Service Line Leader not found.' });
      return;
    }

    const serviceLineId = Number(serviceLine.nsline);

    // Get badges for this service line using a simpler approach like consultorModel
    const rows = await sequelize.query(
      `
        SELECT
          b.nbadge AS id,
          b.b_nome AS name,
          b.b_descricao AS description,
          a.area,
          n.nivel AS level
        FROM badge b
        INNER JOIN b_pertence_sl bps ON bps.nbadge = b.nbadge AND bps.nsline = :serviceLineId
        LEFT JOIN nivel_contem_b ncb ON ncb.nbadge = b.nbadge
        LEFT JOIN nivel n ON n.nnivel = ncb.nnivel
        LEFT JOIN area a ON a.narea = n.narea
        ORDER BY b.b_nome ASC
      `,
      { replacements: { serviceLineId }, type: QueryTypes.SELECT }
    );




    res.status(200).json(rows);
  } catch (error) {
    res.status(500).json({ message: error?.message || 'Failed to fetch badges.' });
  }
};

// Histórico - Consultores da Service Line do SLL
export const getHistoricoConsultoresSLL = async (req, res) => {
  const accountId = parseAccountId(req.query?.accountId);

  if (!accountId) {
    res.status(400).json({ message: 'Account id is required.' });
    return;
  }

  try {
    const serviceLine = await getServiceLineForLeader(accountId);

    if (!serviceLine) {
      res.status(404).json({ message: 'Service Line Leader not found.' });
      return;
    }

    const serviceLineId = Number(serviceLine.nsline);

    const rows = await sequelize.query(
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
            SUM(COALESCE(NULLIF(cb.pontos_obtidos, 0), NULLIF(b.pontos, 0), 0)) AS points
          FROM c_obtem_b cb
          INNER JOIN badge b
            ON b.nbadge = cb.nbadge
          INNER JOIN sl_badges sb
            ON sb.nbadge = cb.nbadge
          GROUP BY cb.nutilizador
        )
        SELECT
          u.nutilizador AS id,
          u.nome AS name,
          u.email,
          COALESCE(pb.points, 0) AS points,
          COALESCE(DATE(u.data_registo), CURRENT_DATE) AS "joinedAt",
          CASE
            WHEN LOWER(COALESCE(u.status, '')) IN ('ativo', 'inativo', 'pendente') THEN LOWER(u.status)
            ELSE 'inativo'
          END AS status
        FROM consultores_na_sl csl
        INNER JOIN utilizador u
          ON u.nutilizador = csl.nutilizador
        LEFT JOIN points_badges pb
          ON pb.nutilizador = u.nutilizador
        WHERE LOWER(COALESCE(u.permissoes, '')) LIKE '%consultor%'
        ORDER BY u.nome ASC
      `,
      { replacements: { serviceLineId },
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
export const getDetalhesConsultorSLL = async (req, res) => {
  const accountId = parseAccountId(req.query?.accountId);
  const consultorId = parseAccountId(req.query?.consultorId);

  if (!accountId || !consultorId) {
    res.status(400).json({ message: 'Account id and consultor id are required.' });
    return;
  }

  try {
    const serviceLine = await getServiceLineForLeader(accountId);

    if (!serviceLine) {
      res.status(404).json({ message: 'Service Line Leader not found.' });
      return;
    }

    const serviceLineId = Number(serviceLine.nsline);

    const [hasAccessToConsultor] = await sequelize.query(
      `
        WITH sl_badges AS (
          SELECT bps.nbadge
          FROM b_pertence_sl bps
          WHERE bps.nsline = :serviceLineId
        )
        SELECT 1
        FROM (
          SELECT cb.nutilizador
          FROM c_obtem_b cb
          INNER JOIN sl_badges sb
            ON sb.nbadge = cb.nbadge
          UNION
          SELECT p.nutilizador
          FROM pedidos p
          INNER JOIN sl_badges sb
            ON sb.nbadge = p.nbadge
        ) src
        WHERE src.nutilizador = :consultorId
        LIMIT 1
      `,
      {
        replacements: { serviceLineId, consultorId },
        type: QueryTypes.SELECT,
      },
    );

    if (!hasAccessToConsultor) {
      res.status(404).json({ message: 'Consultor not found in this service line.' });
      return;
    }

    const [consultor] = await sequelize.query(
      `
        SELECT
          u.nutilizador AS id,
          u.nome AS name,
          u.email,
          COALESCE(points_by_sl.total_points, 0) AS "totalPoints"
        FROM utilizador u
        LEFT JOIN (
          SELECT
            cb.nutilizador,
            SUM(COALESCE(NULLIF(cb.pontos_obtidos, 0), NULLIF(b.pontos, 0), 0)) AS total_points
          FROM c_obtem_b cb
          INNER JOIN badge b
            ON b.nbadge = cb.nbadge
          INNER JOIN b_pertence_sl bps
            ON bps.nbadge = cb.nbadge
           AND bps.nsline = :serviceLineId
          WHERE cb.nutilizador = :consultorId
          GROUP BY cb.nutilizador
        ) points_by_sl
          ON points_by_sl.nutilizador = u.nutilizador
        WHERE u.nutilizador = :consultorId
          AND LOWER(COALESCE(u.permissoes, '')) LIKE '%consultor%'
        LIMIT 1
      `,
      {
        replacements: { consultorId, serviceLineId },
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
          sl.sline AS "serviceLineName",
          cb.data_obtencao AS "obtainedDate",
          COALESCE(NULLIF(cb.pontos_obtidos, 0), NULLIF(b.pontos, 0), 0) AS points
        FROM c_obtem_b cb
        INNER JOIN badge b
          ON b.nbadge = cb.nbadge
        INNER JOIN b_pertence_sl bps
          ON bps.nbadge = b.nbadge
         AND bps.nsline = :serviceLineId
        INNER JOIN service_line sl
          ON sl.nsline = bps.nsline
        LEFT JOIN LATERAL (
          SELECT a.area
          FROM nivel_contem_b ncb
          LEFT JOIN nivel n
            ON n.nnivel = ncb.nnivel
          LEFT JOIN area a
            ON a.narea = n.narea
          WHERE ncb.nbadge = b.nbadge
          ORDER BY n.nnivel ASC
          LIMIT 1
        ) lvl
          ON TRUE
        WHERE cb.nutilizador = :consultorId
        ORDER BY cb.data_obtencao DESC, cb.nbadge DESC
      `,
      {
        replacements: { consultorId, serviceLineId },
        type: QueryTypes.SELECT,
      },
    );

    const rawBadgesEmProgresso = await sequelize.query(
      `
        SELECT DISTINCT ON (p.nbadge)
          p.nbadge AS id,
          b.b_nome AS name,
          lvl.area AS "areaName",
          sl.sline AS "serviceLineName",
          LOWER(COALESCE(e.estado, '')) AS workflow_status,
          p.data_submissao AS "requestDate"
        FROM pedidos p
        INNER JOIN badge b
          ON b.nbadge = p.nbadge
        INNER JOIN b_pertence_sl bps
          ON bps.nbadge = b.nbadge
         AND bps.nsline = :serviceLineId
        INNER JOIN service_line sl
          ON sl.nsline = bps.nsline
        INNER JOIN estado e
          ON e.nestado = p.estado
        LEFT JOIN LATERAL (
          SELECT a.area
          FROM nivel_contem_b ncb
          LEFT JOIN nivel n
            ON n.nnivel = ncb.nnivel
          LEFT JOIN area a
            ON a.narea = n.narea
          WHERE ncb.nbadge = b.nbadge
          ORDER BY n.nnivel ASC
          LIMIT 1
        ) lvl
          ON TRUE
        WHERE p.nutilizador = :consultorId
          AND LOWER(COALESCE(e.estado, '')) IN (:pendingEstadoNames)
        ORDER BY p.nbadge, p.data_submissao DESC, p.npedido DESC
      `,
      {
        replacements: { consultorId, serviceLineId, pendingEstadoNames },
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
export const getDetalhesBadgeSLL = async (req, res) => {
  const accountId = parseAccountId(req.query?.accountId);
  const badgeId = parseAccountId(req.query?.badgeId);

  if (!accountId || !badgeId) {
    res.status(400).json({ message: 'Account id and badge id are required.' });
    return;
  }

  try {
    const serviceLine = await getServiceLineForLeader(accountId);

    if (!serviceLine) {
      res.status(404).json({ message: 'Service Line Leader not found.' });
      return;
    }

    const serviceLineId = Number(serviceLine.nsline);

    const areas = await sequelize.query(
      `
        SELECT DISTINCT
          a.narea AS id,
          a.area AS name,
          COUNT(DISTINCT b.nbadge) AS totalBadges
        FROM area a
        INNER JOIN badge b ON b.narea = a.narea
        INNER JOIN b_pertence_sl bps ON bps.nbadge = b.nbadge AND bps.nsline = :serviceLineId
        GROUP BY a.narea, a.area
        ORDER BY a.area ASC
      `,
      { replacements: { serviceLineId }, type: QueryTypes.SELECT }
    );

    const [badge] = await sequelize.query(
      `
        SELECT
          b.nbadge AS id,
          b.b_nome AS name,
          b.b_descricao AS description,
          lvl.area AS "areaName",
          sl.sline AS "serviceLineName",
          lvl.nivel AS level,
          COALESCE(NULLIF(b.pontos, 0), 0) AS points
        FROM badge b
        INNER JOIN b_pertence_sl bps
          ON bps.nbadge = b.nbadge
         AND bps.nsline = :serviceLineId
        INNER JOIN service_line sl
          ON sl.nsline = bps.nsline
        LEFT JOIN LATERAL (
          SELECT
            a.area,
            n.nivel
          FROM nivel_contem_b ncb
          LEFT JOIN nivel n
            ON n.nnivel = ncb.nnivel
          LEFT JOIN area a
            ON a.narea = n.narea
          WHERE ncb.nbadge = b.nbadge
          ORDER BY n.nnivel ASC
          LIMIT 1
        ) lvl
          ON TRUE
        WHERE b.nbadge = :badgeId
        LIMIT 1
      `,
      {
        replacements: { badgeId, serviceLineId },
        type: QueryTypes.SELECT,
      },
    );

    if (!badge) {
      res.status(404).json({ message: 'Badge not found in this service line.' });
      return;
    }

    const consultoresObtidos = await sequelize.query(
      `
        SELECT
          u.nutilizador AS id,
          u.nome AS name,
          u.email,
          sl.sline AS "serviceLineName",
          cb.data_obtencao AS "obtainedDate"
        FROM c_obtem_b cb
        INNER JOIN utilizador u
          ON u.nutilizador = cb.nutilizador
        INNER JOIN b_pertence_sl bps
          ON bps.nbadge = cb.nbadge
         AND bps.nsline = :serviceLineId
        INNER JOIN service_line sl
          ON sl.nsline = bps.nsline
        WHERE cb.nbadge = :badgeId
          AND LOWER(COALESCE(u.permissoes, '')) LIKE '%consultor%'
        ORDER BY cb.data_obtencao DESC, u.nome ASC
      `,
      {
        replacements: { badgeId, serviceLineId },
        type: QueryTypes.SELECT,
      },
    );

    const rawConsultoresEmProgresso = await sequelize.query(
      `
        SELECT DISTINCT ON (p.nutilizador)
          u.nutilizador AS id,
          u.nome AS name,
          u.email,
          sl.sline AS "serviceLineName",
          p.data_submissao AS "requestDate",
          LOWER(COALESCE(e.estado, '')) AS workflow_status
        FROM pedidos p
        INNER JOIN utilizador u
          ON u.nutilizador = p.nutilizador
        INNER JOIN estado e
          ON e.nestado = p.estado
        INNER JOIN b_pertence_sl bps
          ON bps.nbadge = p.nbadge
         AND bps.nsline = :serviceLineId
        INNER JOIN service_line sl
          ON sl.nsline = bps.nsline
        WHERE p.nbadge = :badgeId
          AND LOWER(COALESCE(e.estado, '')) IN (:pendingEstadoNames)
          AND LOWER(COALESCE(u.permissoes, '')) LIKE '%consultor%'
        ORDER BY p.nutilizador, p.data_submissao DESC, p.npedido DESC
      `,
      {
        replacements: { badgeId, serviceLineId, pendingEstadoNames },
        type: QueryTypes.SELECT,
      },
    );

    const consultoresEmProgresso = rawConsultoresEmProgresso.map((consultor) => ({
      ...consultor,
      status: mapWorkflowStatusToUi(consultor.workflow_status),
    }));

    res.status(200).json({
      badge,
      consultoresObtidos: consultoresObtidos || [],
      consultoresEmProgresso: consultoresEmProgresso || [],
      totalObtidos: consultoresObtidos?.length || 0,
      totalEmProgresso: consultoresEmProgresso?.length || 0,
    });
  } catch (error) {
    res.status(500).json({ message: error?.message || 'Failed to fetch badge details.' });
  }
};

// Endpoints para histórico por estado
export const getHistoricoPorEstado = async (req, res) => {
  const accountId = parseAccountId(req.query?.accountId);
  const estado = req.query?.estado;
  const type = req.path.includes('service-line') ? 'serviceLine' : 
               req.path.includes('area') ? 'area' : 
               req.path.includes('badge') ? 'badge' : 'consultor';





  // Map frontend estados to database estados (using numeric IDs like request management)
  const estadoMap = {
    'pendente': 3,  // pendente-sll
    'aceite': 4,    // aprovado
    'rejeitado': 1   // rejeitado
  };
  
  const dbEstadoId = estadoMap[estado] || estado;


  if (!accountId || !estado) {

    res.status(400).json({ message: 'Account id and estado are required.' });
    return;
  }

  try {
    const serviceLine = await getServiceLineForLeader(accountId);

    if (!serviceLine) {

      res.status(404).json({ message: 'Service Line Leader not found.' });
      return;
    }

    const serviceLineId = Number(serviceLine.nsline);

    
    let data = [];

    if (type === 'serviceLine') {
      // Histórico de pedidos para toda a service line
      const rows = await sequelize.query(
        `
        SELECT
          p.npedido AS id,
          sl.sline AS name,
          b.b_nome AS descricao,
          TO_CHAR(p.data_submissao, 'YYYY-MM-DD') AS data,
          e.estado
        FROM pedidos p
        INNER JOIN badge b ON b.nbadge = p.nbadge
        INNER JOIN b_pertence_sl bps ON bps.nbadge = b.nbadge AND bps.nsline = :serviceLineId
        INNER JOIN service_line sl ON sl.nsline = bps.nsline
        INNER JOIN estado e ON e.nestado = p.estado
        WHERE p.estado = :dbEstadoId
        ORDER BY p.data_submissao DESC
        `,
        {
          replacements: { serviceLineId, dbEstadoId },
          type: QueryTypes.SELECT,
        },
      );
      data = rows.map(row => ({
        ...row,
        estado: mapWorkflowStatusToUi(row.estado)
      }));

    } else if (type === 'area') {
      const areaId = parseAccountId(req.query?.areaId);

      if (!areaId) {

        res.status(400).json({ message: 'Area id is required.' });
        return;
      }

      const rows = await sequelize.query(
        `
        SELECT
          p.npedido AS id,
          a.area AS name,
          b.b_nome AS badge,
          u.nome AS consultor,
          TO_CHAR(p.data_submissao, 'YYYY-MM-DD') AS data,
          e.estado
        FROM pedidos p
        INNER JOIN badge b ON b.nbadge = p.nbadge
        INNER JOIN area a ON a.narea = b.narea
        INNER JOIN b_pertence_sl bps ON bps.nbadge = b.nbadge AND bps.nsline = :serviceLineId
        INNER JOIN utilizador u ON u.nutilizador = p.nutilizador
        INNER JOIN estado e ON e.nestado = p.estado
        WHERE a.narea = :areaId
          AND p.estado = :dbEstadoId
        ORDER BY p.data_submissao DESC
        `,
        {
          replacements: { serviceLineId, areaId, dbEstadoId },
          type: QueryTypes.SELECT,
        },
      );
      data = rows.map(row => ({
        ...row,
        estado: mapWorkflowStatusToUi(row.estado)
      }));

    } else if (type === 'badge') {
      const badgeId = parseAccountId(req.query?.badgeId);

      if (!badgeId) {

        res.status(400).json({ message: 'Badge id is required.' });
        return;
      }

      const rows = await sequelize.query(
        `
        SELECT
          p.npedido AS id,
          b.b_nome AS name,
          u.nome AS consultor,
          TO_CHAR(p.data_submissao, 'YYYY-MM-DD') AS data,
          e.estado
        FROM pedidos p
        INNER JOIN badge b ON b.nbadge = p.nbadge
        INNER JOIN b_pertence_sl bps ON bps.nbadge = b.nbadge AND bps.nsline = :serviceLineId
        INNER JOIN utilizador u ON u.nutilizador = p.nutilizador
        INNER JOIN estado e ON e.nestado = p.estado
        WHERE b.nbadge = :badgeId
          AND p.estado = :dbEstadoId
        ORDER BY p.data_submissao DESC
        `,
        {
          replacements: { serviceLineId, badgeId, dbEstadoId },
          type: QueryTypes.SELECT,
        },
      );
      data = rows.map(row => ({
        ...row,
        estado: mapWorkflowStatusToUi(row.estado)
      }));

    } else if (type === 'consultor') {
      const consultorId = parseAccountId(req.query?.consultorId);

      if (!consultorId) {

        res.status(400).json({ message: 'Consultor id is required.' });
        return;
      }

      const rows = await sequelize.query(
        `
        SELECT
          p.npedido AS id,
          u.nome AS name,
          b.b_nome AS badge,
          TO_CHAR(p.data_submissao, 'YYYY-MM-DD') AS data,
          e.estado
        FROM pedidos p
        INNER JOIN badge b ON b.nbadge = p.nbadge
        INNER JOIN b_pertence_sl bps ON bps.nbadge = b.nbadge AND bps.nsline = :serviceLineId
        INNER JOIN utilizador u ON u.nutilizador = p.nutilizador
        INNER JOIN estado e ON e.nestado = p.estado
        WHERE p.nutilizador = :consultorId
          AND p.estado = :dbEstadoId
        ORDER BY p.data_submissao DESC
        `,
        {
          replacements: { serviceLineId, consultorId, dbEstadoId },
          type: QueryTypes.SELECT,
        },
      );
      data = rows.map(row => ({
        ...row,
        estado: mapWorkflowStatusToUi(row.estado)
      }));

    }



    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: error?.message || 'Failed to fetch historico por estado.' });
  }
};

// Histórico de Candidatura - Service Line Leader
export const getHistoricoCandidaturaSLL = async (req, res) => {
  const pedidoId = parseAccountId(req.query?.pedidoId);

  if (!pedidoId) {
    res.status(400).json({ message: 'Pedido id is required.' });
    return;
  }

  try {
    const rows = await sequelize.query(
      `
        SELECT
          ph.nhistorico AS id,
          e.estado,
          COALESCE(u.nome, 'Sistema') AS "utilizadorNome",
          ph.data_estado AS "dataEstado",
          ph.descricao
        FROM pedido_historico ph
        INNER JOIN estado e ON e.nestado = ph.nestado
        LEFT JOIN utilizador u ON u.nutilizador = ph.nutilizador
        WHERE ph.npedido = :pedidoId
        ORDER BY ph.data_estado ASC
      `,
      {
        replacements: { pedidoId },
        type: QueryTypes.SELECT,
      },
    );

    res.status(200).json(rows);
  } catch (error) {
    res.status(500).json({ message: error?.message || 'Failed to fetch candidacy history.' });
  }
};
