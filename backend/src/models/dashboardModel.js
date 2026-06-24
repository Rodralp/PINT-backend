import { QueryTypes } from 'sequelize';
import { consultorModel } from './consultorModel.js';
import { sequelize } from '../config/database.js';

const clone = (value) => JSON.parse(JSON.stringify(value));

// Ensure data_registo column exists in utilizador table
const ensureDataRegistoColumn = async () => {
  try {
    const [columnExists] = await sequelize.query(
      `
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'utilizador'
          AND column_name = 'data_registo'
        LIMIT 1
      `,
      { type: QueryTypes.SELECT },
    );

    if (!columnExists) {

      await sequelize.query(
        `
          ALTER TABLE utilizador
          ADD COLUMN data_registo DATE NOT NULL DEFAULT CURRENT_DATE
        `,
      );

    }
  } catch (error) {
    console.error('❌ Error ensuring data_registo column:', error);
  }
};

const MANAGER_BADGES_TIMELINE_DAYS = 12;
const MANAGER_NEW_CONSULTORES_DAYS = 10;
const MANAGER_TOP_CONSULTORES_LIMIT = 4;
const MANAGER_RECENT_ACTIVITY_LIMIT = 4;
const CONSULTOR_TIMELINE_DAYS = 12;

const managerRoleSet = new Set(['talent-manager', 'service-line-leader', 'admin-gestor']);

const defaultManagerDashboard = Object.freeze({
  badgesTimelineValues: Array.from({ length: MANAGER_BADGES_TIMELINE_DAYS }, () => 0),
  novosConsultoresValues: Array.from({ length: MANAGER_NEW_CONSULTORES_DAYS }, () => 0),
  onlineUsers: 0,
  pendingRequests: 0,
  topConsultores: [],
  recentActivities: [],
});

const formatDateKey = (value) => {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match?.[1]) {
      return match[1];
    }
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const buildDailySeries = (rows, totalDays = 12) => {
  const countsByDate = new Map();

  for (const row of rows || []) {
    const dateKey = formatDateKey(row.activity_date);
    if (!dateKey) {
      continue;
    }

    const currentValue = countsByDate.get(dateKey) || 0;
    countsByDate.set(dateKey, currentValue + (Number(row.activity_count) || 0));
  }

  return Array.from({ length: totalDays }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (totalDays - 1 - index));
    const dateKey = formatDateKey(date);
    return countsByDate.get(dateKey) || 0;
  });
};

const normalizeRequestState = (value) => String(value || '').trim().toLowerCase();

const mapRequestStateToIconKey = (state) => {
  const normalized = normalizeRequestState(state);

  if (normalized === 'aprovado') return 'searchCheck';
  if (normalized === 'pendente-tm' || normalized === 'pendente-sll') return 'clock';
  if (normalized === 'evidencias_insuficientes') return 'alertTriangle';
  return 'alertTriangle';
};

const mapRequestStateToSubtitle = (state) => {
  const normalized = normalizeRequestState(state);

  if (normalized === 'aprovado') return 'Aprovado';
  if (normalized === 'pendente-tm' || normalized === 'pendente-sll') return 'Em validacao';
  if (normalized === 'evidencias_insuficientes') return 'Evidencias insuficientes';
  if (normalized === 'candidatura_em_progresso') return 'Candidatura em progresso';
  return 'Pendente';
};

const mapTopConsultorIconKey = (index) => {
  if (index === 0 || index === 3) return 'trophy';
  if (index === 1) return 'award';
  return 'users';
};

const startOfDay = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const buildTimeframeFromDate = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return 'Recentemente';
  }

  const now = startOfDay(new Date());
  const dateDay = startOfDay(date);
  const diffMs = now.getTime() - dateDay.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  if (diffDays <= 0) return 'Hoje';
  if (diffDays === 1) return 'Ontem';
  if (diffDays < 7) return `Ha ${diffDays} dias`;
  return dateDay.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
};

const normalizeServiceLineIds = (rows) => {
  const ids = (Array.isArray(rows) ? rows : [])
    .map((row) => Number(row.nsline))
    .filter((id) => Number.isInteger(id) && id > 0);
  return ids.length > 0 ? ids : [-1];
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

const getServiceLineScopeForRole = async (role, accountId) => {
  if (role !== 'service-line-leader') {
    return { hasServiceLineScope: false, serviceLineIds: [-1] };
  }

  const parsedAccountId = Number(accountId);
  if (!Number.isInteger(parsedAccountId) || parsedAccountId <= 0) {
    return { hasServiceLineScope: true, serviceLineIds: [-1] };
  }

  const utilizadorId = await getUtilizadorIdByAccountId(parsedAccountId);
  if (!utilizadorId) {
    return { hasServiceLineScope: true, serviceLineIds: [-1] };
  }

  const rows = await sequelize.query(
    `
      SELECT nsline
      FROM sll_leader_sl
      WHERE nutilizador = :utilizadorId
      ORDER BY nsline ASC
    `,
    {
      replacements: { utilizadorId },
      type: QueryTypes.SELECT,
    },
  );

  return {
    hasServiceLineScope: true,
    serviceLineIds: normalizeServiceLineIds(rows),
  };
};

const buildScopedBadgeCondition = (badgeColumn) => `
  (
    :hasServiceLineScope = FALSE
    OR EXISTS (
      SELECT 1
      FROM b_pertence_sl AS bps
      WHERE bps.nbadge = ${badgeColumn}
        AND bps.nsline IN (:serviceLineIds)
    )
  )
`;

const getPendingStatesByRole = (role) => {
  if (role === 'service-line-leader') {
    return ['pendente-sll'];
  }

  if (role === 'admin-gestor') {
    return ['pendente-tm', 'pendente-sll'];
  }

  return ['pendente-tm'];
};

const getVisibleStatesByRole = (role) => {
  const allStates = ['rejeitado', 'pendente-tm', 'pendente-sll', 'aprovado'];

  if (role === 'service-line-leader') {
    return ['rejeitado', 'pendente-sll', 'aprovado'];
  }

  if (role === 'talent-manager' || role === 'admin-gestor') {
    return allStates;
  }

  return allStates;
};

const getManagerDashboardDataFromDb = async (role, accountId) => {
  if (!managerRoleSet.has(role)) {
    return clone(defaultManagerDashboard);
  }

  // Ensure required columns exist
  await ensureDataRegistoColumn();

  const scope = await getServiceLineScopeForRole(role, accountId);
  const commonScopeReplacements = {
    hasServiceLineScope: scope.hasServiceLineScope,
    serviceLineIds: scope.serviceLineIds,
  };

  const pendingStates = getPendingStatesByRole(role);
  const visibleStates = getVisibleStatesByRole(role);




  const [badgesTimelineRows, novosConsultoresRows, onlineUsersRows, pendingRequestsRows, topConsultoresRows, activitiesRows] = await Promise.all([
    sequelize.query(
      `
        WITH latest AS (
          SELECT DISTINCT ON (p.nutilizador, p.nbadge)
            p.npedido,
            p.data_submissao,
            p.estado
          FROM pedidos AS p
          WHERE ${buildScopedBadgeCondition('p.nbadge')}
          ORDER BY p.nutilizador, p.nbadge, p.data_submissao DESC, p.npedido DESC
        )
        SELECT
          DATE(l.data_submissao) AS activity_date,
          COUNT(DISTINCT l.npedido) AS activity_count
        FROM latest AS l
        LEFT JOIN estado AS e
          ON e.nestado = l.estado
        WHERE LOWER(COALESCE(e.estado, '')) IN (:visibleStates)
        GROUP BY DATE(l.data_submissao)
        ORDER BY activity_date ASC
      `,
      {
        replacements: {
          ...commonScopeReplacements,
          visibleStates,
        },
        type: QueryTypes.SELECT,
      },
    ),
    sequelize.query(
      `
        SELECT
          COALESCE(DATE(u.data_registo), CURRENT_DATE) AS activity_date,
          COUNT(DISTINCT u.nutilizador) AS activity_count
        FROM utilizador AS u
        WHERE LOWER(COALESCE(u.permissoes, '')) LIKE '%consultor%'
          AND (
            :hasServiceLineScope = FALSE
            OR EXISTS (
              SELECT 1
              FROM pedidos AS p_scope
              WHERE p_scope.nutilizador = u.nutilizador
                AND ${buildScopedBadgeCondition('p_scope.nbadge')}
            )
          )
        GROUP BY COALESCE(DATE(u.data_registo), CURRENT_DATE)
        ORDER BY activity_date ASC
      `,
      {
        replacements: commonScopeReplacements,
        type: QueryTypes.SELECT,
      },
    ),
    sequelize.query(
      `
        SELECT COUNT(*)::int AS total
        FROM utilizador AS u
        WHERE LOWER(COALESCE(u.status, '')) = 'ativo'
      `,
      {
        type: QueryTypes.SELECT,
      },
    ),
    sequelize.query(
      `
        WITH latest AS (
          SELECT DISTINCT ON (p.nutilizador, p.nbadge)
            p.npedido,
            p.estado
          FROM pedidos AS p
          WHERE ${buildScopedBadgeCondition('p.nbadge')}
          ORDER BY p.nutilizador, p.nbadge, p.npedido DESC
        )
        SELECT COUNT(l.npedido)::int AS total
        FROM latest AS l
        LEFT JOIN estado AS e
          ON e.nestado = l.estado
        WHERE LOWER(COALESCE(e.estado, '')) IN (:pendingStates)
      `,
      {
        replacements: {
          ...commonScopeReplacements,
          pendingStates,
        },
        type: QueryTypes.SELECT,
      },
    ),
    sequelize.query(
      `
        WITH scoped_requests AS (
          SELECT DISTINCT p.nutilizador
          FROM pedidos AS p
          WHERE ${buildScopedBadgeCondition('p.nbadge')}
        ),
        badge_scores AS (
          SELECT
            cb.nutilizador,
            SUM(COALESCE(NULLIF(cb.pontos_obtidos, 0), NULLIF(b.pontos, 0), 0)) AS points,
            COUNT(DISTINCT cb.nbadge) AS badges
          FROM c_obtem_b AS cb
          INNER JOIN badge AS b
            ON b.nbadge = cb.nbadge
          WHERE ${buildScopedBadgeCondition('cb.nbadge')}
          GROUP BY cb.nutilizador
        ),
        scope_consultores AS (
          SELECT nutilizador FROM scoped_requests
          UNION
          SELECT nutilizador FROM badge_scores
        )
        SELECT
          u.nutilizador AS id,
          u.nome AS name,
          u.email,
          COALESCE(bs.points, 0) AS points,
          COALESCE(bs.badges, 0) AS badges
        FROM scope_consultores AS sc
        INNER JOIN utilizador AS u
          ON u.nutilizador = sc.nutilizador
        LEFT JOIN badge_scores AS bs
          ON bs.nutilizador = u.nutilizador
        WHERE LOWER(COALESCE(u.permissoes, '')) LIKE '%consultor%'
        ORDER BY points DESC, badges DESC, u.nome ASC
        LIMIT :topLimit
      `,
      {
        replacements: {
          ...commonScopeReplacements,
          topLimit: MANAGER_TOP_CONSULTORES_LIMIT,
        },
        type: QueryTypes.SELECT,
      },
    ),
    sequelize.query(
      `
        SELECT activity_date, title, icon_key
        FROM (
          SELECT
            p.data_submissao AS activity_date,
            CASE
              WHEN LOWER(COALESCE(e.estado, '')) = 'rejeitado' THEN CONCAT('Pedido rejeitado: ', COALESCE(b.b_nome, 'Badge'))
              WHEN LOWER(COALESCE(e.estado, '')) IN ('aprovado') THEN CONCAT('Pedido aprovado: ', COALESCE(b.b_nome, 'Badge'))
              WHEN LOWER(COALESCE(e.estado, '')) IN ('pendente-sll', 'pendente-tm') THEN CONCAT('Pedido em validacao: ', COALESCE(b.b_nome, 'Badge'))
              ELSE CONCAT('Pedido submetido: ', COALESCE(b.b_nome, 'Badge'))
            END AS title,
            'fileText' AS icon_key
          FROM pedidos AS p
          INNER JOIN utilizador AS u
            ON u.nutilizador = p.nutilizador
          LEFT JOIN badge AS b
            ON b.nbadge = p.nbadge
          LEFT JOIN estado AS e
            ON e.nestado = p.estado
          WHERE LOWER(COALESCE(u.permissoes, '')) LIKE '%consultor%'
            AND ${buildScopedBadgeCondition('p.nbadge')}

          UNION ALL

          SELECT
            cb.data_obtencao AS activity_date,
            CONCAT('Badge aprovada: ', COALESCE(b.b_nome, 'Badge')) AS title,
            'checkCircle' AS icon_key
          FROM c_obtem_b AS cb
          INNER JOIN utilizador AS u
            ON u.nutilizador = cb.nutilizador
          LEFT JOIN badge AS b
            ON b.nbadge = cb.nbadge
          WHERE LOWER(COALESCE(u.permissoes, '')) LIKE '%consultor%'
            AND ${buildScopedBadgeCondition('cb.nbadge')}

          UNION ALL

          SELECT
            u.data_registo AS activity_date,
            CONCAT('Novo consultor registado: ', COALESCE(u.nome, 'Consultor')) AS title,
            'users' AS icon_key
          FROM utilizador AS u
          WHERE LOWER(COALESCE(u.permissoes, '')) LIKE '%consultor%'
            AND (
              :hasServiceLineScope = FALSE
              OR EXISTS (
                SELECT 1
                FROM pedidos AS p_scope
                WHERE p_scope.nutilizador = u.nutilizador
                  AND ${buildScopedBadgeCondition('p_scope.nbadge')}
              )
            )
        ) AS recent_activities
        WHERE activity_date IS NOT NULL
        ORDER BY activity_date DESC, title ASC
        LIMIT :activityLimit
      `,
      {
        replacements: {
          ...commonScopeReplacements,
          activityLimit: MANAGER_RECENT_ACTIVITY_LIMIT,
        },
        type: QueryTypes.SELECT,
      },
    ),
  ]);









  let avatarMap = {};
  try {
    const { utilizadorImagemModel } = await import('./utilizadorImagemModel.js');
    const consultorIds = (Array.isArray(topConsultoresRows) ? topConsultoresRows : []).map((r) => Number(r.id)).filter(Boolean);
    if (consultorIds.length > 0) {
      avatarMap = await utilizadorImagemModel.loadUserImagesBatch(consultorIds);
    }
  } catch { /* no images */ }

  const topConsultores = (Array.isArray(topConsultoresRows) ? topConsultoresRows : []).map((row, index) => ({
    id: Number(row.id),
    name: row.name || 'Consultor',
    email: row.email || '',
    iconKey: mapTopConsultorIconKey(index),
    rank: index + 1,
    avatar: avatarMap[Number(row.id)] || null,
    points: Number(row.points) || 0,
    badges: Number(row.badges) || 0,
  }));

  const recentActivities = (Array.isArray(activitiesRows) ? activitiesRows : []).map((row, index) => ({
    id: index + 1,
    title: row.title || 'Atividade recente',
    timeframe: buildTimeframeFromDate(row.activity_date),
    iconKey: row.icon_key || 'fileText',
  }));

  const result = {
    badgesTimelineValues: buildDailySeries(badgesTimelineRows, MANAGER_BADGES_TIMELINE_DAYS),
    novosConsultoresValues: buildDailySeries(novosConsultoresRows, MANAGER_NEW_CONSULTORES_DAYS),
    onlineUsers: Number(onlineUsersRows?.[0]?.total) || 0,
    pendingRequests: Number(pendingRequestsRows?.[0]?.total) || 0,
    topConsultores,
    recentActivities,
  };

  return result;
};

const defaultConsultorStats = Object.freeze([
  {
    titleKey: 'dashboard_stat_badges_title',
    value: '0',
    iconKey: 'award',
    tone: 'gold',
  },
  {
    titleKey: 'dashboard_stat_streak_title',
    value: '0',
    iconKey: 'flame',
    tone: 'fire',
  },
  {
    titleKey: 'dashboard_stat_requests_title',
    value: '0',
    iconKey: 'clock',
    tone: 'blue',
  },
  {
    titleKey: 'dashboard_stat_ranking_title',
    value: '#0',
    iconKey: 'crown',
    tone: 'rank',
  },
]);

const RECENT_SPECIAL_BADGE_DAYS = 7;

const defaultConsultorDashboard = Object.freeze({
  timelineValues: Array.from({ length: CONSULTOR_TIMELINE_DAYS }, () => 0),
  stats: defaultConsultorStats,
  inProgressItems: [],
  suggestionItems: [],
  recentActivities: [],
  newSpecialBadges: [],
});

export const dashboardModel = {
  async getTalentManagerDashboardData(accountId) {
    return getManagerDashboardDataFromDb('talent-manager', accountId);
  },

  async getServiceLineLeaderDashboardData(accountId) {
    return getManagerDashboardDataFromDb('service-line-leader', accountId);
  },

  async getAdminGestorDashboardData(accountId) {
    return getManagerDashboardDataFromDb('admin-gestor', accountId);
  },

  async getConsultorDashboardData(accountId) {
    const parsedAccountId = Number(accountId);
    if (!Number.isInteger(parsedAccountId) || parsedAccountId <= 0) {
      return clone(defaultConsultorDashboard);
    }

    try {
      const profileData = await consultorModel.getProfileData(parsedAccountId);

      const [timelineRows, inProgressRows, suggestionItems, newSpecialBadgeRows] = await Promise.all([
        sequelize.query(
          `
            SELECT
              DATE(cb.data_obtencao) AS activity_date,
              COUNT(DISTINCT cb.nbadge) AS activity_count
            FROM c_obtem_b AS cb
            WHERE cb.nutilizador = :accountId
            GROUP BY DATE(cb.data_obtencao)
            ORDER BY activity_date ASC
          `,
          {
            replacements: { accountId: parsedAccountId },
            type: QueryTypes.SELECT,
          },
        ),
        sequelize.query(
          `
            SELECT
              p.npedido,
              b.b_nome,
              p.data_submissao,
              COALESCE(e.estado, 'pendente') AS estado
            FROM pedidos AS p
            INNER JOIN badge AS b
              ON b.nbadge = p.nbadge
            LEFT JOIN estado AS e
              ON e.nestado = p.estado
            WHERE p.nutilizador = :accountId
              AND LOWER(COALESCE(e.estado, '')) <> 'aprovado'
            ORDER BY p.data_submissao DESC, p.npedido DESC
            LIMIT 3
          `,
          {
            replacements: { accountId: parsedAccountId },
            type: QueryTypes.SELECT,
          },
        ),
        consultorModel.getBadgeSuggestions(parsedAccountId, 3).catch(() => []),
        sequelize.query(
          `
            SELECT
              cb.nbadge,
              cb.data_obtencao,
              b.b_nome,
              b.b_descricao,
              b.pontos,
              b.imagem,
              t.tipo
            FROM c_obtem_b AS cb
            INNER JOIN badge AS b
              ON b.nbadge = cb.nbadge
            INNER JOIN tipo AS t
              ON t.ntipo = b.ntipo
            WHERE cb.nutilizador = :accountId
              AND LOWER(t.tipo) = 'especial'
              AND cb.data_obtencao >= CURRENT_DATE - INTERVAL '${RECENT_SPECIAL_BADGE_DAYS} days'
            ORDER BY cb.data_obtencao DESC
          `,
          {
            replacements: { accountId: parsedAccountId },
            type: QueryTypes.SELECT,
          },
        ),
      ]);

      const timelineValues = buildDailySeries(timelineRows, CONSULTOR_TIMELINE_DAYS);

      const inProgressItems = (inProgressRows || []).map((row) => {
        const estado = normalizeRequestState(row.estado);
        return {
          title: row.b_nome || 'Badge',
          subtitle: mapRequestStateToSubtitle(estado),
          accent: estado === 'aprovado' ? 'success' : estado === 'evidencias_insuficientes' ? 'amber' : 'warning',
          iconKey: mapRequestStateToIconKey(estado),
        };
      });

      const stats = Array.isArray(profileData?.stats) && profileData.stats.length > 0
        ? profileData.stats
        : clone(defaultConsultorDashboard.stats);

      const newSpecialBadges = (Array.isArray(newSpecialBadgeRows) ? newSpecialBadgeRows : []).map((row) => ({
        nbadge: Number(row.nbadge),
        name: row.b_nome || 'Badge Especial',
        description: row.b_descricao || '',
        points: Number(row.pontos) || 0,
        image: row.imagem || null,
        tipo: row.tipo || 'Especial',
        date: row.data_obtencao || null,
      }));

      return {
        timelineValues,
        stats,
        inProgressItems,
        suggestionItems: Array.isArray(suggestionItems) ? suggestionItems : [],
        recentActivities: Array.isArray(profileData.activityItems)
          && profileData.activityItems.length > 0
          ? profileData.activityItems.slice(0, 4).map((item, index) => ({
            id: item.id || index + 1,
            title: item.description,
            timeframe: item.date,
            iconKey: item.icon === 'award' ? 'award' : 'fileText',
          }))
          : [],
        newSpecialBadges,
      };
    } catch (error) {
      console.error('❌ getConsultorDashboardData error:', error.message);
      return clone(defaultConsultorDashboard);
    }
  },
};
