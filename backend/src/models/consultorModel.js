import { QueryTypes } from 'sequelize';
import { Reminder } from './sql/Reminder.js';
import { Account } from './sql/Account.js';
import { sequelize } from '../config/database.js';
import { adminBadgeModel } from './adminBadgeModel.js';
const { loadBadgeImagesBatch } = adminBadgeModel;
import { communicationModel } from './communicationModel.js';
import { sendEmail } from '../services/emailService.js';
import { emailTemplates } from '../services/emailTemplates.js';

const clone = (value) => JSON.parse(JSON.stringify(value));
const pedidoEstados = Object.freeze({
  candidaturaEmProgresso: 'candidatura_em_progresso',
  emValidacaoTm: 'pendente-tm',
  emValidacaoTmLegacy: 'em_validacao',
  emValidacaoSll: 'pendente-sll',
  emValidacaoSllLegacy: 'em_validacao_sll',
  evidenciasInsuficientes: 'evidencias_insuficientes',
  rejeitado: 'rejeitado',
  aprovado: 'aprovado',
});

const badgeLevelTemplates = [
  {
    levelKey: 'badge_level_junior',
    points: 100,
    badgeImage: '/badges/J%C3%BAnior.png',
  },
  {
    levelKey: 'badge_level_intermediate',
    points: 150,
    badgeImage: '/badges/Interm%C3%A9dio.png',
  },
  {
    levelKey: 'badge_level_senior',
    points: 200,
    badgeImage: '/badges/S%C3%A9nior.png',
  },
  {
    levelKey: 'badge_level_specialist',
    points: 250,
    badgeImage: '/badges/Especialista.png',
  },
  {
    levelKey: 'badge_level_knowledge_lead',
    points: 300,
    badgeImage: '/badges/L%C3%ADder%20de%20Conhecimento.png',
  },
];

const suggestionAccentPalette = ['success', 'violet', 'amber', 'warning', 'info', 'yellow'];

const SPECIAL_BADGE_TYPE_NAME = 'Especial';
const specialTriggerDefinitions = Object.freeze({
  badge_count: {
    baseTitle: 'Número de badges obtidas',
    buildDescription: (value) => `Obter pelo menos ${value} badge(s) aprovadas.`,
  },
  ranking_position: {
    baseTitle: 'Posição no ranking',
    buildDescription: (value) => `Atingir a posição #${value} ou melhor no ranking de consultores.`,
  },
  streak_days: {
    baseTitle: 'Streak de atividade',
    buildDescription: (value) => `Manter uma streak de atividade de pelo menos ${value} dia(s) consecutivos.`,
  },
});

const normalizeLevelTitle = (value) => {
  const rawTitle = String(value || '').trim();
  const withoutPathPrefix = rawTitle.includes(' - ')
    ? rawTitle.split(' - ').slice(1).join(' - ').trim()
    : rawTitle;

  return withoutPathPrefix.replace(/^nivel\s+/i, '').trim();
};

const normalizeForCompare = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const isSpecialTypeName = (value) => normalizeForCompare(value) === 'especial';

const normalizePedidoEstado = (estado) => String(estado || '').trim().toLowerCase();
const isEstadoEmValidacaoTm = (estado) => (
  estado === pedidoEstados.emValidacaoTm || estado === pedidoEstados.emValidacaoTmLegacy
);
const isEstadoEmValidacaoSll = (estado) => (
  estado === pedidoEstados.emValidacaoSll || estado === pedidoEstados.emValidacaoSllLegacy
);
const isEstadoEmValidacao = (estado) => isEstadoEmValidacaoTm(estado) || isEstadoEmValidacaoSll(estado);

const mapPedidoEstadoToLearningPathStatus = (estado) => {
  const normalized = normalizePedidoEstado(estado);

  if (normalized === pedidoEstados.candidaturaEmProgresso) {
    return 'candidatura_em_progresso';
  }

  if (isEstadoEmValidacaoTm(normalized)) {
    return 'pendente-tm';
  }

  if (isEstadoEmValidacaoSll(normalized)) {
    return 'pendente-sll';
  }

  if (normalized === pedidoEstados.evidenciasInsuficientes || normalized === pedidoEstados.rejeitado) {
    return 'evidencias_insuficientes';
  }

  if (normalized === pedidoEstados.aprovado) {
    return 'obtido';
  }

  return 'visualizar';
};

const mapPedidoEstadoToMyBadgeState = (estado) => {
  const normalized = normalizePedidoEstado(estado);

  if (normalized === pedidoEstados.candidaturaEmProgresso) {
    return 'candidatura_em_progresso';
  }

  if (isEstadoEmValidacaoTm(normalized)) {
    return 'pendente-tm';
  }

  if (isEstadoEmValidacaoSll(normalized)) {
    return 'pendente-sll';
  }

  if (normalized === pedidoEstados.evidenciasInsuficientes || normalized === pedidoEstados.rejeitado) {
    return 'rejeitado';
  }

  if (normalized === pedidoEstados.aprovado) {
    return 'aprovado';
  }

  return 'pendente-tm';
};

const mapPedidoEstadoToMyRequestStatus = (estado) => {
  const normalized = normalizePedidoEstado(estado);

  if (normalized === pedidoEstados.aprovado) {
    return 'aprovado';
  }

  if (normalized === pedidoEstados.evidenciasInsuficientes || normalized === pedidoEstados.rejeitado) {
    return 'rejeitado';
  }

  return 'pendente';
};

const resolveBadgeTemplateByTypeName = (typeName) => {
  const normalizedTypeName = String(typeName || '').trim().toLowerCase();

  if (normalizedTypeName.includes('junior')) {
    return badgeLevelTemplates[0];
  }

  if (normalizedTypeName.includes('intermedio') || normalizedTypeName.includes('interm')) {
    return badgeLevelTemplates[1];
  }

  if (normalizedTypeName.includes('senior')) {
    return badgeLevelTemplates[2];
  }

  if (normalizedTypeName.includes('especialista')) {
    return badgeLevelTemplates[3];
  }

  if (normalizedTypeName.includes('lider')) {
    return badgeLevelTemplates[4];
  }

  return null;
};

const resolveBadgeTemplate = (levelName, fallbackIndex = 0, typeName = null) => {
  const templateFromType = resolveBadgeTemplateByTypeName(typeName);
  if (templateFromType) {
    return templateFromType;
  }

  const normalizedLevelName = String(levelName || '').trim().toLowerCase();

  if (normalizedLevelName.includes('junior')) {
    return badgeLevelTemplates[0];
  }

  if (normalizedLevelName.includes('intermedio') || normalizedLevelName.includes('interm')) {
    return badgeLevelTemplates[1];
  }

  if (normalizedLevelName.includes('senior')) {
    return badgeLevelTemplates[2];
  }

  if (normalizedLevelName.includes('especialista')) {
    return badgeLevelTemplates[3];
  }

  if (normalizedLevelName.includes('lider')) {
    return badgeLevelTemplates[4];
  }

  return badgeLevelTemplates[fallbackIndex % badgeLevelTemplates.length];
};

const resolveBadgeImage = (customImage, fallbackImage, isSpecial = false) => {
  const normalizedCustomImage = String(customImage || '').trim();
  if (normalizedCustomImage) {
    return normalizedCustomImage;
  }

  if (isSpecial) {
    return '/badges/default.png';
  }

  return fallbackImage || '/badges/default.png';
};

const hasActiveBadgeRequest = (status) =>
  status === 'candidatura_em_progresso'
  || status === 'pendente-tm'
  || status === 'pendente-sll'
  || status === 'obtido';

const formatDate = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return '12 Jan 2026';
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleString('en-US', { month: 'short' });
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
};

const formatShortDate = (value) => {
  if (!value) {
    return '--/--/----';
  }

  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return `${match[3]}/${match[2]}/${match[1]}`;
    }
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '--/--/----';
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const toUtcDayKey = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
};

const calculateConsecutiveDayStreak = (values) => {
  const uniqueDayKeys = [...new Set(
    (Array.isArray(values) ? values : [])
      .map(toUtcDayKey)
      .filter((value) => Number.isFinite(value)),
  )].sort((a, b) => b - a);

  if (uniqueDayKeys.length === 0) {
    return 0;
  }

  let streak = 1;
  let previousDayKey = uniqueDayKeys[0];

  for (let index = 1; index < uniqueDayKeys.length; index += 1) {
    const currentDayKey = uniqueDayKeys[index];
    const expectedPreviousDayKey = previousDayKey - (24 * 60 * 60 * 1000);

    if (currentDayKey !== expectedPreviousDayKey) {
      break;
    }

    streak += 1;
    previousDayKey = currentDayKey;
  }

  return streak;
};

const buildSpecialRequirement = (badgeId, triggerType, triggerValue, index = 0) => {
  const definition = specialTriggerDefinitions[triggerType];
  const safeValue = Number(triggerValue);
  const safeIndex = Number(index) + 1;

  if (!definition || !Number.isInteger(safeValue) || safeValue <= 0) {
    return {
      id: `special-${badgeId}-${triggerType}-${safeIndex}`,
      title: 'Trigger especial',
      description: `Cumprir a condição especial definida (${triggerType}: ${safeValue || 0}).`,
      files: 0,
      attachments: [],
      triggerType,
      triggerValue: safeValue || 0,
    };
  }

  return {
    id: `special-${badgeId}-${triggerType}-${safeIndex}`,
    title: definition.baseTitle,
    description: definition.buildDescription(safeValue),
    files: 0,
    attachments: [],
    triggerType,
    triggerValue: safeValue,
  };
};

const loadSpecialRequirementsByBadgeIds = async (badgeIds) => {
  const normalizedBadgeIds = normalizeBadgeIds(badgeIds);
  const requirementsByBadge = new Map();

  if (normalizedBadgeIds.length === 0) {
    return requirementsByBadge;
  }

  const rows = await sequelize.query(
    `
      SELECT
        bt.nbadge,
        bt.trigger_tipo,
        bt.trigger_valor
      FROM badge_trigger AS bt
      WHERE bt.nbadge IN (:badgeIds)
      ORDER BY bt.nbadge ASC, bt.trigger_tipo ASC
    `,
    {
      replacements: { badgeIds: normalizedBadgeIds },
      type: QueryTypes.SELECT,
    },
  );

  for (const row of rows) {
    const badgeId = Number(row.nbadge);
    if (!requirementsByBadge.has(badgeId)) {
      requirementsByBadge.set(badgeId, []);
    }

    const currentRequirements = requirementsByBadge.get(badgeId);
    currentRequirements.push(
      buildSpecialRequirement(
        badgeId,
        String(row.trigger_tipo || '').trim(),
        Number(row.trigger_valor),
        currentRequirements.length,
      ),
    );
  }

  return requirementsByBadge;
};

const isSpecialTriggerSatisfied = (triggerType, triggerValue, metrics) => {
  const safeValue = Number(triggerValue);
  if (!Number.isInteger(safeValue) || safeValue <= 0) {
    return false;
  }

  if (triggerType === 'badge_count') {
    return Number(metrics?.badgeCount || 0) >= safeValue;
  }

  if (triggerType === 'ranking_position') {
    const rankingPosition = Number(metrics?.rankingPosition || 0);
    return Number.isInteger(rankingPosition) && rankingPosition > 0 && rankingPosition <= safeValue;
  }

  if (triggerType === 'streak_days') {
    return Number(metrics?.streakDays || 0) >= safeValue;
  }

  return false;
};

const collectConsultorMetrics = async (utilizadorId, transaction) => {
  const [badgeCountRow, rankingRow, streakRows] = await Promise.all([
    sequelize.query(
      `
        SELECT COUNT(DISTINCT cb.nbadge) AS total_badges
        FROM c_obtem_b AS cb
        WHERE cb.nutilizador = :utilizadorId
      `,
      {
        replacements: { utilizadorId: Number(utilizadorId) },
        type: QueryTypes.SELECT,
        transaction,
      },
    ),
    sequelize.query(
      `
        WITH consultor_points AS (
          SELECT
            u.nutilizador,
            COALESCE(SUM(COALESCE(NULLIF(cb.pontos_obtidos, 0), NULLIF(b.pontos, 0), 0)), 0) AS points
          FROM utilizador AS u
          LEFT JOIN c_obtem_b AS cb
            ON cb.nutilizador = u.nutilizador
          LEFT JOIN badge AS b
            ON b.nbadge = cb.nbadge
          WHERE LOWER(u.permissoes) LIKE '%consultor%'
          GROUP BY u.nutilizador
        ),
        ranked AS (
          SELECT
            nutilizador,
            RANK() OVER (ORDER BY points DESC, nutilizador ASC) AS ranking_position
          FROM consultor_points
        )
        SELECT ranking_position
        FROM ranked
        WHERE nutilizador = :utilizadorId
        LIMIT 1
      `,
      {
        replacements: { utilizadorId: Number(utilizadorId) },
        type: QueryTypes.SELECT,
        transaction,
      },
    ),
    sequelize.query(
      `
        SELECT DISTINCT activity_date
        FROM (
          SELECT DATE(p.data_submissao) AS activity_date
          FROM pedidos AS p
          WHERE p.nutilizador = :utilizadorId
          UNION
          SELECT DATE(l.data_log) AS activity_date
          FROM logs AS l
          WHERE l.nutilizador = :utilizadorId
        ) AS activity_days
        WHERE activity_date IS NOT NULL
        ORDER BY activity_date DESC
      `,
      {
        replacements: { utilizadorId: Number(utilizadorId) },
        type: QueryTypes.SELECT,
        transaction,
      },
    ),
  ]);

  return {
    badgeCount: Number(badgeCountRow?.[0]?.total_badges) || 0,
    rankingPosition: Number(rankingRow?.[0]?.ranking_position) || 0,
    streakDays: calculateConsecutiveDayStreak((streakRows || []).map((row) => row.activity_date)),
  };
};

export const syncSpecialBadgesForConsultor = async (utilizadorId) => {
  const approvedEstadoId = await ensureEstadoId('aprovado');

  await sequelize.transaction(async (transaction) => {
    const specialBadgeRows = await sequelize.query(
      `
        SELECT
          b.nbadge,
          b.pontos,
          bt.trigger_tipo,
          bt.trigger_valor
        FROM badge AS b
        INNER JOIN tipo AS t
          ON t.ntipo = b.ntipo
        INNER JOIN badge_trigger AS bt
          ON bt.nbadge = b.nbadge
        WHERE LOWER(t.tipo) = LOWER(:specialTypeName)
        ORDER BY b.nbadge ASC, bt.trigger_tipo ASC
      `,
      {
        replacements: { specialTypeName: SPECIAL_BADGE_TYPE_NAME },
        type: QueryTypes.SELECT,
        transaction,
      },
    );

    if (!specialBadgeRows || specialBadgeRows.length === 0) {
      return;
    }

    const badgeDefinitions = new Map();
    for (const row of specialBadgeRows) {
      const badgeId = Number(row.nbadge);
      if (!badgeDefinitions.has(badgeId)) {
        badgeDefinitions.set(badgeId, {
          badgeId,
          points: Number(row.pontos) || 0,
          triggers: [],
        });
      }

      badgeDefinitions.get(badgeId).triggers.push({
        type: String(row.trigger_tipo || '').trim(),
        value: Number(row.trigger_valor),
      });
    }

    const obtainedRows = await sequelize.query(
      `
        SELECT nbadge
        FROM c_obtem_b
        WHERE nutilizador = :utilizadorId
      `,
      {
        replacements: { utilizadorId: Number(utilizadorId) },
        type: QueryTypes.SELECT,
        transaction,
      },
    );

    const obtainedBadgeIds = new Set(obtainedRows.map((row) => Number(row.nbadge)));
    let hasNewAwards = true;
    let safetyCounter = 0;

    while (hasNewAwards && safetyCounter < 20) {
      safetyCounter += 1;
      hasNewAwards = false;
      const metrics = await collectConsultorMetrics(utilizadorId, transaction);

      for (const definition of badgeDefinitions.values()) {
        if (obtainedBadgeIds.has(definition.badgeId)) {
          continue;
        }

        const allTriggersMet = definition.triggers.length > 0
          && definition.triggers.every((trigger) =>
            isSpecialTriggerSatisfied(trigger.type, trigger.value, metrics),
          );

        if (!allTriggersMet) {
          continue;
        }

        const [createdRequest] = await sequelize.query(
          `
            INSERT INTO pedidos (nbadge, nutilizador, estado, data_submissao, data_limite, descricao)
            VALUES (
              :badgeId,
              :utilizadorId,
              :approvedEstadoId,
              CURRENT_DATE,
              CURRENT_DATE + INTERVAL '3 months',
              :descricao
            )
            RETURNING npedido
          `,
          {
            replacements: {
              badgeId: Number(definition.badgeId),
              utilizadorId: Number(utilizadorId),
              approvedEstadoId,
              descricao: 'Badge especial atribuída automaticamente por trigger.',
            },
            type: QueryTypes.SELECT,
            transaction,
          },
        );

        const requestId = Number(createdRequest?.npedido);
        if (!Number.isInteger(requestId) || requestId <= 0) {
          continue;
        }

        await sequelize.query(
          `
            INSERT INTO c_obtem_b (nutilizador, nbadge, npedido, pontos_obtidos, data_obtencao)
            VALUES (:utilizadorId, :badgeId, :requestId, :points, CURRENT_DATE)
            ON CONFLICT (nutilizador, nbadge)
            DO UPDATE SET
              npedido = EXCLUDED.npedido,
              pontos_obtidos = EXCLUDED.pontos_obtidos,
              data_obtencao = EXCLUDED.data_obtencao
          `,
          {
            replacements: {
              utilizadorId: Number(utilizadorId),
              badgeId: Number(definition.badgeId),
              requestId,
              points: Number(definition.points) || 0,
            },
            type: QueryTypes.INSERT,
            transaction,
          },
        );

        obtainedBadgeIds.add(definition.badgeId);
        hasNewAwards = true;
      }
    }
  });
};

const getUtilizadorIdByAccountId = async (accountId) => {
  const [utilizador] = await sequelize.query(
    `
      SELECT nutilizador
      FROM utilizador
      WHERE nutilizador = :accountId
      LIMIT 1
    `,
    {
      replacements: { accountId: Number(accountId) },
      type: QueryTypes.SELECT,
    },
  );

  return utilizador?.nutilizador ? Number(utilizador.nutilizador) : null;
};

const ensureEstadoId = async (estadoNome) => {
  const [existing] = await sequelize.query(
    `
      SELECT nestado
      FROM estado
      WHERE LOWER(estado) = LOWER(:estadoNome)
      LIMIT 1
    `,
    {
      replacements: { estadoNome },
      type: QueryTypes.SELECT,
    },
  );

  if (existing?.nestado) {
    return Number(existing.nestado);
  }

  const [inserted] = await sequelize.query(
    `
      INSERT INTO estado (estado)
      VALUES (:estadoNome)
      RETURNING nestado
    `,
    {
      replacements: { estadoNome },
      type: QueryTypes.SELECT,
    },
  );

  return Number(inserted.nestado);
};

const REQUEST_EXPIRATION_MONTHS = 3;
const AUTO_REJECTION_NOTE = 'Candidatura rejeitada automaticamente por expiracao de prazo.';

const syncRequestDeadlines = async () => {
  await sequelize.query(
    `
      UPDATE pedidos
      SET data_limite = COALESCE(data_limite, data_submissao + INTERVAL '${REQUEST_EXPIRATION_MONTHS} months')
      WHERE data_submissao IS NOT NULL
        AND data_limite IS NULL
    `,
    {
      type: QueryTypes.UPDATE,
    },
  );
};

const autoRejectExpiredRequests = async () => {
  const rejectedId = await ensureEstadoId('rejeitado');
  const approvedId = await ensureEstadoId('aprovado');

  await syncRequestDeadlines();

  await sequelize.query(
    `
      UPDATE pedidos
      SET estado = :rejectedId,
          descricao = COALESCE(NULLIF(descricao, ''), :defaultDescription)
      WHERE data_limite IS NOT NULL
        AND data_limite <= CURRENT_DATE
        AND estado <> :rejectedId
        AND estado <> :approvedId
    `,
    {
      replacements: {
        rejectedId,
        approvedId,
        defaultDescription: AUTO_REJECTION_NOTE,
      },
      type: QueryTypes.UPDATE,
    },
  );
};

const EXPIRATION_NOTIFICATION_THRESHOLD_DAYS = 30;

const sendAllExpirationNotifications = async () => {
  try {
    const expiringBadges = await adminBadgeModel.getExpiringSoonBadges(EXPIRATION_NOTIFICATION_THRESHOLD_DAYS);

    if (!expiringBadges || expiringBadges.length === 0) {
      return;
    }

    const notifiedSet = new Set();

    for (const badge of expiringBadges) {
      const validade = new Date(badge.validade);
      const today = new Date();
      const daysUntilExpiration = Math.ceil((validade - today) / (1000 * 60 * 60 * 24));

      if (daysUntilExpiration <= 0 || daysUntilExpiration > EXPIRATION_NOTIFICATION_THRESHOLD_DAYS) {
        continue;
      }

      const recipientSet = new Set();

      const consultorRows = await sequelize.query(
        `
          SELECT DISTINCT nutilizador AS id FROM c_obtem_b WHERE nbadge = :badgeId
          UNION
          SELECT DISTINCT nutilizador AS id FROM pedidos WHERE nbadge = :badgeId
        `,
        {
          replacements: { badgeId: badge.nbadge },
          type: QueryTypes.SELECT,
        },
      );

      for (const row of consultorRows) {
        const id = Number(row.id);
        if (Number.isInteger(id) && id > 0) {
          recipientSet.add(id);
        }
      }

      const adminRows = await sequelize.query(
        `SELECT nutilizador AS id FROM utilizador WHERE LOWER(status) = 'ativo' AND LOWER(permissoes) LIKE '%admin-gestor%'`,
        { type: QueryTypes.SELECT },
      );
      for (const row of adminRows) {
        const id = Number(row.id);
        if (Number.isInteger(id) && id > 0) recipientSet.add(id);
      }

      const tmRows = await sequelize.query(
        `SELECT nutilizador AS id FROM utilizador WHERE LOWER(status) = 'ativo' AND LOWER(permissoes) LIKE '%talent-manager%'`,
        { type: QueryTypes.SELECT },
      );
      for (const row of tmRows) {
        const id = Number(row.id);
        if (Number.isInteger(id) && id > 0) recipientSet.add(id);
      }

      const sllServiceLines = await sequelize.query(
        `SELECT DISTINCT nsline FROM b_pertence_sl WHERE nbadge = :badgeId`,
        { replacements: { badgeId: badge.nbadge }, type: QueryTypes.SELECT },
      );
      for (const slRow of sllServiceLines) {
        const sllRows = await sequelize.query(
          `
            SELECT DISTINCT sl.nutilizador AS id
            FROM sll_leader_sl sl
            INNER JOIN utilizador u ON u.nutilizador = sl.nutilizador
            WHERE sl.nsline = :nsline AND LOWER(u.status) = 'ativo'
          `,
          { replacements: { nsline: slRow.nsline }, type: QueryTypes.SELECT },
        );
        for (const row of sllRows) {
          const id = Number(row.id);
          if (Number.isInteger(id) && id > 0) recipientSet.add(id);
        }
      }

      const recipients = Array.from(recipientSet);
      if (recipients.length === 0) continue;

      const dedupKey = `expiring:${badge.nbadge}:${daysUntilExpiration}`;
      if (notifiedSet.has(dedupKey)) continue;
      notifiedSet.add(dedupKey);

      const logTitle = `Badge a expirar: ${badge.b_nome} (${daysUntilExpiration} dias)`;

      const [existing] = await sequelize.query(
        `SELECT 1 FROM logs l WHERE l.titulo = :title AND l.nutilizador = :recipientId AND l.data_log = CURRENT_DATE LIMIT 1`,
        {
          replacements: { title: logTitle, recipientId: recipients[0] },
          type: QueryTypes.SELECT,
        },
      );

      if (!existing) {
        await communicationModel.dispatchBadgeExpiringNotification(recipients, badge.b_nome, daysUntilExpiration);
      }
    }
  } catch (error) {
    console.error('Error sending all expiration notifications:', error);
  }
};

const normalizeBadgeIds = (badgeIds) => [...new Set(
  (Array.isArray(badgeIds) ? badgeIds : [])
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0),
)];

const ensureRequirementsForBadges = async (_badgeIds) => {
  // Requirements are managed explicitly in admin; do not auto-create defaults.
};

const loadRequirementsByBadgeIds = async (badgeIds) => {
  const normalizedBadgeIds = normalizeBadgeIds(badgeIds);
  const requirementsByBadge = new Map();

  if (normalizedBadgeIds.length === 0) {
    return requirementsByBadge;
  }

  const rows = await sequelize.query(
    `
      SELECT nbadge, nreq, requisito, r_descricao, imagem
      FROM requisitos
      WHERE nbadge IN (:badgeIds)
      ORDER BY nbadge ASC, nreq ASC
    `,
    {
      replacements: { badgeIds: normalizedBadgeIds },
      type: QueryTypes.SELECT,
    },
  );

  for (const row of rows) {
    const badgeId = Number(row.nbadge);
    if (!requirementsByBadge.has(badgeId)) {
      requirementsByBadge.set(badgeId, []);
    }

    requirementsByBadge.get(badgeId).push({
      id: `req-${Number(row.nreq)}`,
      title: row.requisito || 'Requisito',
      description: row.r_descricao || 'Texto de suporte do requisito associado a candidatura.',
      image: row.imagem || null,
      files: 0,
      attachments: [],
    });
  }

  return requirementsByBadge;
};

const rankingConsultores = [
  { id: 1, name: 'Joao Gomes', email: 'joaogomes1234@softinsa.pt', points: 2450, badges: 12, serviceLine: 'Cloud', avatar: 'https://i.pravatar.cc/120?u=joao.gomes' },
  { id: 2, name: 'Maria Santos', email: 'maria.santos@softinsa.pt', points: 2200, badges: 10, serviceLine: 'Data & AI', avatar: 'https://i.pravatar.cc/120?u=maria.santos' },
  { id: 3, name: 'Pedro Mendes', email: 'pedro.mendes@softinsa.pt', points: 1950, badges: 9, serviceLine: 'Cloud', avatar: 'https://i.pravatar.cc/120?u=pedro.mendes' },
  { id: 4, name: 'Ana Costa', email: 'ana.costa@softinsa.pt', points: 1700, badges: 8, serviceLine: 'LowCode', avatar: 'https://i.pravatar.cc/120?u=ana.costa' },
  { id: 5, name: 'Carlos Ferreira', email: 'carlos.ferreira@softinsa.pt', points: 1500, badges: 7, serviceLine: 'Cybersecurity', avatar: 'https://i.pravatar.cc/120?u=carlos.ferreira' },
  { id: 6, name: 'Rita Oliveira', email: 'rita.oliveira@softinsa.pt', points: 1450, badges: 7, serviceLine: 'Data & AI', avatar: 'https://i.pravatar.cc/120?u=rita.oliveira' },
  { id: 7, name: 'Bruno Alves', email: 'bruno.alves@softinsa.pt', points: 1350, badges: 7, serviceLine: 'Cloud', avatar: 'https://i.pravatar.cc/120?u=bruno.alves' },
  { id: 8, name: 'Sofia Rodrigues', email: 'sofia.rodrigues@softinsa.pt', points: 1250, badges: 7, serviceLine: 'LowCode', avatar: 'https://i.pravatar.cc/120?u=sofia.rodrigues' },
  { id: 9, name: 'Giorgian Arrascarta', email: 'giorgian.arrascarta@softinsa.pt', points: 1250, badges: 6, serviceLine: 'Cybersecurity', avatar: 'https://i.pravatar.cc/120?u=giorgian.arrascarta' },
  { id: 10, name: 'Ana Clara', email: 'ana.clara@softinsa.pt', points: 1200, badges: 6, serviceLine: 'Data & AI', avatar: 'https://i.pravatar.cc/120?u=ana.clara' },
  { id: 11, name: 'Omar Rocha', email: 'omar.rocha@softinsa.pt', points: 1200, badges: 5, serviceLine: 'Cloud', avatar: 'https://i.pravatar.cc/120?u=omar.rocha' },
  { id: 12, name: 'Raquel Ribeiro', email: 'raquel.ribeiro@softinsa.pt', points: 1200, badges: 5, serviceLine: 'LowCode', avatar: 'https://i.pravatar.cc/120?u=raquel.ribeiro' },
];

const buildRankingConsultores = async () => {
  const rows = await sequelize.query(
    `
      WITH badge_scores AS (
        SELECT
          cb.nutilizador,
          SUM(COALESCE(NULLIF(cb.pontos_obtidos, 0), NULLIF(b.pontos, 0), 0)) AS points,
          COUNT(DISTINCT cb.nbadge) AS badges
        FROM c_obtem_b AS cb
        INNER JOIN badge AS b
          ON b.nbadge = cb.nbadge
        GROUP BY cb.nutilizador
      ),
      service_line_scores AS (
        SELECT
          cb.nutilizador,
          sl.sline,
          SUM(COALESCE(NULLIF(cb.pontos_obtidos, 0), NULLIF(b.pontos, 0), 0)) AS points
        FROM c_obtem_b AS cb
        INNER JOIN badge AS b
          ON b.nbadge = cb.nbadge
        LEFT JOIN b_pertence_sl AS bps
          ON bps.nbadge = b.nbadge
        LEFT JOIN service_line AS sl
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
        COALESCE(bs.points, 0) AS points,
        COALESCE(bs.badges, 0) AS badges,
        COALESCE(dsl.sline, 'Application Operations') AS "serviceLine",
        'https://i.pravatar.cc/120?u=' || COALESCE(NULLIF(REPLACE(LOWER(u.email), '@', '.'), ''), LOWER(REPLACE(u.nome, ' ', '.'))) AS avatar
      FROM utilizador AS u
      LEFT JOIN badge_scores AS bs
        ON bs.nutilizador = u.nutilizador
      LEFT JOIN dominant_service_line AS dsl
        ON dsl.nutilizador = u.nutilizador
      WHERE LOWER(u.permissoes) LIKE '%consultor%'
      ORDER BY points DESC, badges DESC, u.nome ASC
    `,
    { type: QueryTypes.SELECT },
  );

  // For each consultor, fetch their service line stats
  const consultoresWithStats = await Promise.all(
    rows.map(async (row) => {
      const serviceLineRows = await sequelize.query(
        `
          SELECT
            COALESCE(sl.sline, 'Application Operations') AS serviceLine,
            COUNT(DISTINCT b.nbadge) AS badges,
            SUM(COALESCE(NULLIF(cb.pontos_obtidos, 0), NULLIF(b.pontos, 0), 0)) AS points
          FROM c_obtem_b AS cb
          INNER JOIN badge AS b
            ON b.nbadge = cb.nbadge
          LEFT JOIN b_pertence_sl AS bps
            ON bps.nbadge = b.nbadge
          LEFT JOIN service_line AS sl
            ON sl.nsline = bps.nsline
          WHERE cb.nutilizador = :accountId
          GROUP BY sl.sline
          ORDER BY COUNT(DISTINCT b.nbadge) DESC, SUM(COALESCE(NULLIF(cb.pontos_obtidos, 0), NULLIF(b.pontos, 0), 0)) DESC
        `,
        {
          replacements: { accountId: Number(row.id) },
          type: QueryTypes.SELECT,
        },
      );

      const serviceLineStats = (serviceLineRows || []).map((r) => ({
        serviceLine: r.serviceline || r.serviceLine || 'Application Operations',
        badges: Number(r.badges) || 0,
        points: Number(r.points) || 0,
      }));

      return {
        id: Number(row.id),
        name: row.name,
        email: row.email,
        points: Number(row.points) || 0,
        badges: Number(row.badges) || 0,
        serviceLine: row.serviceLine || 'Application Operations',
        avatar: row.avatar || `https://i.pravatar.cc/120?u=${encodeURIComponent(row.email || row.name || row.id)}`,
        serviceLineStats,
      };
    }),
  );

  return consultoresWithStats;
};

const profileData = {
  location: '',
  joined: '',
  timelineValues: Array.from({ length: 12 }, () => 0),
  stats: [
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
  ],
  skillsItems: [],
  certificationsItems: [],
  serviceLineStats: [],
};

const buildProfileData = async (accountId) => {
  const parsedAccountId = Number(accountId);

  if (!Number.isInteger(parsedAccountId) || parsedAccountId <= 0) {
    return clone(profileData);
  }

  try {
    await autoRejectExpiredRequests();
  } catch (error) {
    console.error('Error auto-rejecting expired requests:', error);
  }

  try {
    return await _buildProfileDataInner(parsedAccountId);
  } catch (error) {
    console.error('❌ buildProfileData error, returning defaults:', error.message);
    return clone(profileData);
  }
};

const _buildProfileDataInner = async (parsedAccountId) => {
  const [row] = await sequelize.query(
    `
      WITH badge_scores AS (
        SELECT
          cb.nutilizador,
          SUM(COALESCE(NULLIF(cb.pontos_obtidos, 0), NULLIF(b.pontos, 0), 0)) AS points,
          COUNT(DISTINCT cb.nbadge) AS badges
        FROM c_obtem_b AS cb
        INNER JOIN badge AS b
          ON b.nbadge = cb.nbadge
        GROUP BY cb.nutilizador
      ),
      service_line_scores AS (
        SELECT
          cb.nutilizador,
          sl.sline,
          SUM(COALESCE(NULLIF(cb.pontos_obtidos, 0), NULLIF(b.pontos, 0), 0)) AS points
        FROM c_obtem_b AS cb
        INNER JOIN badge AS b
          ON b.nbadge = cb.nbadge
        LEFT JOIN b_pertence_sl AS bps
          ON bps.nbadge = b.nbadge
        LEFT JOIN service_line AS sl
          ON sl.nsline = bps.nsline
        GROUP BY cb.nutilizador, sl.sline
      ),
      dominant_service_line AS (
        SELECT DISTINCT ON (nutilizador)
          nutilizador,
          sline
        FROM service_line_scores
        ORDER BY nutilizador, points DESC, sline ASC
      ),
      consultor_ranking AS (
        SELECT
          u.nutilizador,
          ROW_NUMBER() OVER (
            ORDER BY COALESCE(bs.points, 0) DESC, COALESCE(bs.badges, 0) DESC, u.nome ASC
          ) AS ranking_position
        FROM utilizador AS u
        LEFT JOIN badge_scores AS bs
          ON bs.nutilizador = u.nutilizador
        WHERE LOWER(u.permissoes) LIKE '%consultor%'
      )
      SELECT
        u.nutilizador AS id,
        u.nome,
        u.email,
        COALESCE(bs.points, 0) AS points,
        COALESCE(bs.badges, 0) AS badges,
        COALESCE(dsl.sline, 'Application Operations') AS "serviceLine",
        'https://i.pravatar.cc/120?u=' || COALESCE(NULLIF(REPLACE(LOWER(u.email), '@', '.'), ''), LOWER(REPLACE(u.nome, ' ', '.'))) AS avatar,
        COALESCE(cr.ranking_position, 0) AS ranking
      FROM utilizador AS u
      LEFT JOIN badge_scores AS bs
        ON bs.nutilizador = u.nutilizador
      LEFT JOIN dominant_service_line AS dsl
        ON dsl.nutilizador = u.nutilizador
      LEFT JOIN consultor_ranking AS cr
        ON cr.nutilizador = u.nutilizador
      WHERE u.nutilizador = :accountId
      LIMIT 1
    `,
    {
      replacements: { accountId: parsedAccountId },
      type: QueryTypes.SELECT,
    },
  );

  if (!row) {
    return clone(profileData);
  }
  // compute per-service-line aggregates for this user (badges and points)
  const serviceLineRows = await sequelize.query(
    `
      SELECT
        COALESCE(sl.sline, 'Application Operations') AS serviceLine,
        COUNT(DISTINCT b.nbadge) AS badges,
        SUM(COALESCE(NULLIF(cb.pontos_obtidos, 0), NULLIF(b.pontos, 0), 0)) AS points
      FROM c_obtem_b AS cb
      INNER JOIN badge AS b
        ON b.nbadge = cb.nbadge
      LEFT JOIN b_pertence_sl AS bps
        ON bps.nbadge = b.nbadge
      LEFT JOIN service_line AS sl
        ON sl.nsline = bps.nsline
      WHERE cb.nutilizador = :accountId
      GROUP BY sl.sline
      ORDER BY COUNT(DISTINCT b.nbadge) DESC, SUM(COALESCE(NULLIF(cb.pontos_obtidos, 0), NULLIF(b.pontos, 0), 0)) DESC
    `,
    {
      replacements: { accountId: parsedAccountId },
      type: QueryTypes.SELECT,
    },
  );

  const serviceLineStats = (serviceLineRows || []).map((r) => ({
    serviceLine: r.serviceline || r.serviceLine || 'Application Operations',
    badges: Number(r.badges) || 0,
    points: Number(r.points) || 0,
  }));

  // Build a lightweight certifications list from recently obtained badges
  const certRows = await sequelize.query(
    `
      SELECT DISTINCT ON (cb.nbadge)
        cb.nbadge,
        b.b_nome,
        n.nivel,
        t.tipo
      FROM c_obtem_b AS cb
      INNER JOIN badge AS b
        ON b.nbadge = cb.nbadge
      LEFT JOIN nivel_contem_b AS ncb
        ON ncb.nbadge = b.nbadge
      LEFT JOIN nivel AS n
        ON n.nnivel = ncb.nnivel
      LEFT JOIN tipo AS t
        ON t.ntipo = b.ntipo
      WHERE cb.nutilizador = :accountId
      ORDER BY cb.nbadge, cb.data_obtencao DESC
      LIMIT 5
    `,
    {
      replacements: { accountId: parsedAccountId },
      type: QueryTypes.SELECT,
    },
  );

  const certificationsItems = (certRows || []).map((r) => {
    const template = typeof resolveBadgeTemplate === 'function'
      ? resolveBadgeTemplate(r.nivel, 0, r.tipo)
      : { levelKey: 'badge_level_specialist' };

    return {
      title: r.b_nome || r.nivel || 'Badge',
      levelKey: template.levelKey || 'badge_level_specialist',
    };
  });

  // Fetch request count for this user
  const requestCountRows = await sequelize.query(
    `
      SELECT COUNT(DISTINCT p.npedido) AS request_count
      FROM pedidos AS p
      WHERE p.nutilizador = :accountId
    `,
    {
      replacements: { accountId: parsedAccountId },
      type: QueryTypes.SELECT,
    },
  );

  const requestCount = Number(requestCountRows[0]?.request_count) || 0;

  // Fetch recent activity from pedidos and logs
  const activityRows = await sequelize.query(
    `
      SELECT
        p.npedido AS id,
        CASE 
          WHEN e.estado = 'candidatura_em_progresso' THEN 'Candidatura submetida para ' || b.b_nome
          WHEN e.estado IN ('pendente-tm', 'pendente-sll') THEN 'Candidatura em validação: ' || b.b_nome
          WHEN e.estado = 'aprovado' THEN 'Badge aprovada: ' || b.b_nome
          WHEN e.estado = 'rejeitado' THEN 'Candidatura rejeitada: ' || b.b_nome
          WHEN e.estado = 'evidencias_insuficientes' THEN 'Evidências insuficientes: ' || b.b_nome
          ELSE 'Atividade em badge'
        END AS description,
        p.data_submissao AS activity_date,
        'badge' AS activity_type
      FROM pedidos AS p
      INNER JOIN badge AS b ON p.nbadge = b.nbadge
      LEFT JOIN estado AS e ON p.estado = e.nestado
      WHERE p.nutilizador = :accountId
      ORDER BY p.data_submissao DESC
      LIMIT 5
    `,
    {
      replacements: { accountId: parsedAccountId },
      type: QueryTypes.SELECT,
    },
  );

  const activityItems = (activityRows || []).map((row) => ({
    type: row.activity_type || 'badge',
    description: row.description || 'Nova atividade',
    date: formatDate(row.activity_date),
    icon: 'award',
    color: 'gold',
  }));

  const streakRows = await sequelize.query(
    `
      SELECT DISTINCT activity_date
      FROM (
        SELECT DATE(p.data_submissao) AS activity_date
        FROM pedidos AS p
        WHERE p.nutilizador = :accountId
        UNION
        SELECT DATE(l.data_log) AS activity_date
        FROM logs AS l
        WHERE l.nutilizador = :accountId
      ) AS activity_days
      WHERE activity_date IS NOT NULL
      ORDER BY activity_date DESC
    `,
    {
      replacements: { accountId: parsedAccountId },
      type: QueryTypes.SELECT,
    },
  );

  const streakDays = calculateConsecutiveDayStreak((streakRows || []).map((row) => row.activity_date));

  return {
    ...clone(profileData),
    points: Number(row.points) || 0,
    badges: Number(row.badges) || 0,
    ranking: Number(row.ranking) || 0,
    streakDays,
    serviceLine: row.serviceLine || 'Application Operations',
    avatar: row.avatar || `https://i.pravatar.cc/120?u=${encodeURIComponent(row.email || row.nome || row.id)}`,
    serviceLineStats,
    stats: [
      {
        titleKey: 'dashboard_stat_badges_title',
        value: String(Number(row.badges) || 0),
        iconKey: 'award',
        tone: 'gold',
      },
      {
        titleKey: 'dashboard_stat_streak_title',
        value: String(streakDays),
        iconKey: 'flame',
        tone: 'fire',
      },
      {
        titleKey: 'dashboard_stat_requests_title',
        value: String(requestCount),
        iconKey: 'clock',
        tone: 'blue',
      },
      {
        titleKey: 'dashboard_stat_ranking_title',
        value: `#${Number(row.ranking) || 0}`,
        iconKey: 'crown',
        tone: 'rank',
      },
    ],
    skillsItems: (serviceLineStats || []).slice(0, 3).map((s) => ({
      title: s.serviceLine || s.name,
      subtitleKey: 'badge_level_specialist',
      accent: 'yellow',
    })),
    activityItems: activityItems.length > 0 ? activityItems : clone(profileData.activityItems),
    certificationsItems: certificationsItems.length > 0 ? certificationsItems : clone(profileData.certificationsItems || []),
    user: {
      id: Number(row.id),
      name: row.nome,
      email: row.email,
    },
  };
};

const buildLearningPaths = async (accountId) => {
  try { await autoRejectExpiredRequests(); } catch (e) { console.error('Error auto-rejecting expired requests:', e); }
  try { await adminBadgeModel.checkAndExpireBadges(); } catch (e) { console.error('Error checking expired badges:', e); }
  const rows = await sequelize.query(
    `
      SELECT
        lp.nlpath,
        lp.lpath,
        lp.lp_desc,
        sl.nsline,
        sl.sline,
        sl.sl_desc,
        sl.imagem AS sl_image,
        a.narea,
        a.area,
        a.a_desc,
        n.nnivel,
        n.nivel,
        nb.nbadge
      FROM learning_path AS lp
      INNER JOIN service_line AS sl
        ON sl.nlpath = lp.nlpath
       AND sl.is_active = TRUE
      LEFT JOIN area AS a
        ON a.nsline = sl.nsline
       AND a.is_active = TRUE
      LEFT JOIN nivel AS n
        ON n.narea = a.narea
       AND n.is_active = TRUE
      LEFT JOIN nivel_contem_b AS nb
        ON nb.nnivel = n.nnivel
      LEFT JOIN badge AS b
        ON b.nbadge = nb.nbadge
      WHERE lp.is_active = TRUE
        AND (b.nbadge IS NULL OR b.validade IS NULL OR b.validade > CURRENT_DATE)
      ORDER BY lp.nlpath ASC, sl.nsline ASC, a.narea ASC, n.nnivel ASC
    `,
    { type: QueryTypes.SELECT },
  );
  const badgeIds = normalizeBadgeIds(rows.map((row) => row.nbadge));
  await ensureRequirementsForBadges(badgeIds);
  const requirementsByBadge = await loadRequirementsByBadgeIds(badgeIds);

  let userBadges = [];
  let userRequests = [];

  const utilizadorId = accountId ? await getUtilizadorIdByAccountId(accountId) : null;
  if (utilizadorId) {
    const [loadedBadges, loadedRequests] = await Promise.all([
      sequelize.query(
        `
          SELECT nbadge
          FROM c_obtem_b
          WHERE nutilizador = :utilizadorId
        `,
        {
          replacements: { utilizadorId },
          type: QueryTypes.SELECT,
        },
      ),
      sequelize.query(
        `
          SELECT p.npedido, p.nbadge, e.estado
          FROM pedidos AS p
          INNER JOIN estado AS e
            ON e.nestado = p.estado
          WHERE p.nutilizador = :utilizadorId
          ORDER BY p.data_submissao DESC, p.npedido DESC
        `,
        {
          replacements: { utilizadorId },
          type: QueryTypes.SELECT,
        },
      ),
    ]);

    userBadges = loadedBadges;
    userRequests = loadedRequests;
  }

  const obtainedBadgeIds = new Set(userBadges.map((b) => Number(b.nbadge)));
  const requestMetadataByBadge = new Map();
  for (const r of userRequests) {
    const badgeId = Number(r.nbadge);
    if (!requestMetadataByBadge.has(badgeId)) {
      requestMetadataByBadge.set(badgeId, {
        status: mapPedidoEstadoToLearningPathStatus(r.estado),
        requestId: Number(r.npedido) || null,
      });
    }
  }

  const getRequestMetaForBadge = (nbadge) => {
    if (!nbadge) {
      return { status: 'visualizar', requestId: null };
    }

    if (obtainedBadgeIds.has(nbadge)) {
      return { status: 'obtido', requestId: null };
    }

    if (requestMetadataByBadge.has(Number(nbadge))) {
      return requestMetadataByBadge.get(Number(nbadge));
    }

    return { status: 'visualizar', requestId: null };
  };

  const learningPathMap = new Map();
  const serviceLineMap = new Map();
  const areaMap = new Map();

  for (const row of rows) {
    const pathId = `learning-path-${Number(row.nlpath)}`;
    const serviceLineId = `service-line-${Number(row.nsline)}`;
    const areaId = row.narea ? `area-${Number(row.narea)}` : null;

    if (!learningPathMap.has(pathId)) {
      learningPathMap.set(pathId, {
        id: pathId,
        name: row.lpath,
        description: row.lp_desc,
        serviceLines: [],
      });
    }

    const learningPath = learningPathMap.get(pathId);
    const serviceLineMapKey = `${pathId}:${serviceLineId}`;
    let serviceLine = serviceLineMap.get(serviceLineMapKey);

    if (!serviceLine) {
      serviceLine = {
        id: serviceLineId,
        name: row.sline,
        description: row.sl_desc,
        image: row.sl_image || '/LP_BG.png',
        areas: [],
      };

      learningPath.serviceLines.push(serviceLine);
      serviceLineMap.set(serviceLineMapKey, serviceLine);
    }

    if (!areaId) {
      continue;
    }

    const areaMapKey = `${serviceLineMapKey}:${areaId}`;
    let area = areaMap.get(areaMapKey);

    if (!area) {
      area = {
        id: areaId,
        name: row.area,
        description: row.a_desc,
        levels: [],
      };

      serviceLine.areas.push(area);
      areaMap.set(areaMapKey, area);
    }

    if (row.nnivel) {
      const template = badgeLevelTemplates[area.levels.length % badgeLevelTemplates.length];
      const badgeDbId = row.nbadge ? Number(row.nbadge) : null;
      const requestMeta = getRequestMetaForBadge(badgeDbId);
      const requirements = badgeDbId
        ? clone(requirementsByBadge.get(badgeDbId) || [])
        : [];

      area.levels.push({
        id: `nivel-${Number(row.nnivel)}`,
        title: normalizeLevelTitle(row.nivel),
        subtitle: `Nivel ${area.levels.length + 1}`,
        ...template,
        badgeDbId,
        requestId: requestMeta.requestId,
        requirements,
        status: requestMeta.status,
      });
    }
  }

  return Array.from(learningPathMap.values());
};

const buildMyBadges = async (accountId) => {
  try {
    await autoRejectExpiredRequests();
  } catch (error) {
    console.error('Error auto-rejecting expired requests:', error);
  }

  try {
    await adminBadgeModel.checkAndExpireBadges();
  } catch (error) {
    console.error('Error checking expired badges:', error);
  }

  const utilizadorId = await getUtilizadorIdByAccountId(accountId);
  if (!utilizadorId) {
    return [];
  }

  const [obtainedRows, requestRows] = await Promise.all([
    sequelize.query(
      `
        SELECT DISTINCT ON (cb.nbadge)
          cb.nbadge,
          b.b_nome,
          a.area,
          n.nivel,
          b.imagem,
          t.tipo,
          cb.pontos_obtidos,
          cb.data_obtencao,
          cb.nutilizador,
          b.validade
        FROM c_obtem_b AS cb
        INNER JOIN badge AS b
          ON b.nbadge = cb.nbadge
        LEFT JOIN tipo AS t
          ON t.ntipo = b.ntipo
        LEFT JOIN nivel_contem_b AS ncb
          ON ncb.nbadge = cb.nbadge
        LEFT JOIN nivel AS n
          ON n.nnivel = ncb.nnivel
        LEFT JOIN area AS a
          ON a.narea = n.narea
        WHERE cb.nutilizador = :utilizadorId
          AND (b.validade IS NULL OR b.validade > CURRENT_DATE)
        ORDER BY cb.nbadge
      `,
      {
        replacements: { utilizadorId },
        type: QueryTypes.SELECT,
      },
    ),
    sequelize.query(
      `
        SELECT DISTINCT ON (p.nbadge)
          p.npedido,
          p.nbadge,
          p.data_submissao,
          e.estado,
          b.b_nome,
          b.imagem,
          b.pontos AS badge_pontos,
          t.tipo,
          a.area,
          n.nivel,
          b.validade
        FROM pedidos AS p
        INNER JOIN estado AS e
          ON e.nestado = p.estado
        LEFT JOIN badge AS b
          ON b.nbadge = p.nbadge
        LEFT JOIN tipo AS t
          ON t.ntipo = b.ntipo
        LEFT JOIN nivel_contem_b AS ncb
          ON ncb.nbadge = p.nbadge
        LEFT JOIN nivel AS n
          ON n.nnivel = ncb.nnivel
        LEFT JOIN area AS a
          ON a.narea = n.narea
        WHERE p.nutilizador = :utilizadorId
          AND (b.validade IS NULL OR b.validade > CURRENT_DATE)
        ORDER BY p.nbadge, p.data_submissao DESC, p.npedido DESC
      `,
      {
        replacements: { utilizadorId },
        type: QueryTypes.SELECT,
      },
    ),
  ]);

  const requestIds = requestRows
    .map((row) => Number(row.npedido))
    .filter((requestId) => Number.isInteger(requestId) && requestId > 0);
  const requestBadgeIds = requestRows
    .map((row) => Number(row.nbadge))
    .filter((badgeId) => Number.isInteger(badgeId) && badgeId > 0);

  await ensureRequirementsForBadges(requestBadgeIds);
  const requirementsByBadge = await loadRequirementsByBadgeIds(requestBadgeIds);

  const evidenceRows = requestIds.length > 0
    ? await sequelize.query(
      `
        SELECT
          e.npedido,
          e.nreq,
          e.nevidencias,
          e.nevidencia,
          e.formato
        FROM evidencias AS e
        WHERE e.npedido IN (:requestIds)
        ORDER BY e.npedido ASC, e.nreq ASC, e.nevidencias ASC
      `,
      {
        replacements: { requestIds },
        type: QueryTypes.SELECT,
      },
    )
    : [];

  const evidenceByRequest = new Map();

  for (const row of evidenceRows) {
    const requestId = Number(row.npedido);
    const requirementId = Number(row.nreq);
    const requirementKey = Number.isInteger(requirementId) && requirementId > 0 ? `req-${requirementId}` : null;

    if (!evidenceByRequest.has(requestId)) {
      evidenceByRequest.set(requestId, {
        byRequirement: new Map(),
        unscoped: [],
      });
    }

    const requirementState = evidenceByRequest.get(requestId);
    const labelBase = String(row.nevidencia || 'evidencia').trim();
    const extension = String(row.formato || '').trim();
    const attachmentLabel = extension && !labelBase.toLowerCase().endsWith(`.${extension.toLowerCase()}`)
      ? `${labelBase}.${extension}`
      : labelBase;

    const attachment = {
      id: `evidence-${Number(row.nevidencias) || `${requestId}-${labelBase}`}`,
      evidenceId: Number(row.nevidencias) || null,
      type: extension === 'pdf' ? 'pdf' : 'file',
      label: attachmentLabel,
    };

    if (!requirementKey) {
      requirementState.unscoped.push(attachment);
      continue;
    }

    if (!requirementState.byRequirement.has(requirementKey)) {
      requirementState.byRequirement.set(requirementKey, {
        files: 0,
        attachments: [],
      });
    }

    const requirementItem = requirementState.byRequirement.get(requirementKey);
    requirementItem.files += 1;
    requirementItem.attachments.push(attachment);
  }

  const items = [];
  const existingBadgeIds = new Set();

  for (const row of obtainedRows) {
    const isSpecial = isSpecialTypeName(row.tipo);
    const template = resolveBadgeTemplate(row.nivel, 0, row.tipo);
    const badgeId = Number(row.nbadge);
    existingBadgeIds.add(badgeId);

    items.push({
      id: `badge-${badgeId}`,
      badgeDbId: badgeId,
      name: row.b_nome || row.area || 'Badge',
      area: row.area || row.b_nome || 'Badge',
      stateId: 'aprovado',
      status: 'obtido',
      levelKey: isSpecial ? null : template.levelKey,
      points: Number(row.pontos_obtidos) || template.points,
      badgeImage: resolveBadgeImage(row.imagem, template.badgeImage, isSpecial),
      date: formatDate(row.data_obtencao),
      validade: row.validade || null,
    });
  }

  for (const row of requestRows) {
    const badgeId = Number(row.nbadge);
    if (existingBadgeIds.has(badgeId)) {
      continue;
    }

    const isSpecial = isSpecialTypeName(row.tipo);
    const template = resolveBadgeTemplate(row.nivel, 0, row.tipo);
    const mappedStatus = mapPedidoEstadoToLearningPathStatus(row.estado);
    const requestId = Number(row.npedido);
    const requestEvidence = evidenceByRequest.get(requestId);
    const badgeRequirements = clone(requirementsByBadge.get(badgeId) || []);

    for (const requirement of badgeRequirements) {
      const requirementEvidence = requestEvidence?.byRequirement?.get(String(requirement.id));
      if (!requirementEvidence) {
        requirement.files = Number(requirement.files) || 0;
        requirement.attachments = Array.isArray(requirement.attachments) ? requirement.attachments : [];
        continue;
      }

      requirement.files = requirementEvidence.files;
      requirement.attachments = requirementEvidence.attachments;
    }

    if (badgeRequirements.length > 0 && requestEvidence?.unscoped?.length) {
      const firstRequirement = badgeRequirements[0];
      firstRequirement.files = Number(firstRequirement.files || 0) + requestEvidence.unscoped.length;
      firstRequirement.attachments = [...(firstRequirement.attachments || []), ...requestEvidence.unscoped];
    }

    items.push({
      id: `badge-${badgeId}`,
      badgeDbId: badgeId,
      requestId,
      name: row.b_nome || row.area || 'Badge',
      area: row.area || row.b_nome || 'Badge',
      stateId: mapPedidoEstadoToMyBadgeState(row.estado),
      status: mapPedidoEstadoToMyRequestStatus(row.estado),
      levelKey: isSpecial ? null : template.levelKey,
      points: Number(row.badge_pontos) > 0 ? Number(row.badge_pontos) : template.points,
      badgeImage: resolveBadgeImage(row.imagem, template.badgeImage, isSpecial),
      date: formatDate(row.data_submissao),
      requirements: badgeRequirements,
      evidence: badgeRequirements,
      validade: row.validade || null,
    });
  }

  const allBadgeIds = items.map((item) => item.badgeDbId).filter(Boolean);
  const imageMap = await loadBadgeImagesBatch(allBadgeIds);

  for (const item of items) {
    if (imageMap[item.badgeDbId]) {
      item.badgeImage = imageMap[item.badgeDbId];
    }
  }

  return items.sort((left, right) => right.points - left.points);
};

const buildMyRequests = async (accountId) => {
  try { await autoRejectExpiredRequests(); } catch (e) { console.error('Error auto-rejecting expired requests:', e); }
  try { await adminBadgeModel.checkAndExpireBadges(); } catch (e) { console.error('Error checking expired badges:', e); }
  const utilizadorId = await getUtilizadorIdByAccountId(accountId);
  if (!utilizadorId) {
    return [];
  }

  const rows = await sequelize.query(
    `
      SELECT
        p.npedido,
        p.data_submissao,
        e.estado,
        b.b_nome,
        b.validade,
        meta.area,
        meta.nivel
      FROM pedidos AS p
      INNER JOIN estado AS e
        ON e.nestado = p.estado
      LEFT JOIN badge AS b
        ON b.nbadge = p.nbadge
      LEFT JOIN (
        SELECT DISTINCT ON (ncb.nbadge)
          ncb.nbadge,
          a.area,
          n.nivel
        FROM nivel_contem_b AS ncb
        LEFT JOIN nivel AS n
          ON n.nnivel = ncb.nnivel
        LEFT JOIN area AS a
          ON a.narea = n.narea
        ORDER BY ncb.nbadge, n.nnivel ASC
      ) AS meta
        ON meta.nbadge = p.nbadge
      WHERE p.nutilizador = :utilizadorId
        AND (b.validade IS NULL OR b.validade > CURRENT_DATE)
      ORDER BY p.data_submissao DESC, p.npedido DESC
    `,
    {
      replacements: { utilizadorId },
      type: QueryTypes.SELECT,
    },
  );

  return rows.map((row) => {
    const level = normalizeLevelTitle(row.nivel) || 'Intermedio';

    return {
      id: Number(row.npedido),
      badge: row.b_nome || row.area || 'Badge',
      level,
      date: formatShortDate(row.data_submissao),
      status: mapPedidoEstadoToMyRequestStatus(row.estado),
      validade: row.validade || null,
    };
  });
};

const getSelectedAreaRowsByUtilizadorId = async (utilizadorId) => {
  if (!utilizadorId) {
    return [];
  }

  return sequelize.query(
    `
      SELECT
        a.narea,
        a.area,
        a.a_desc,
        sl.sline
      FROM preferencias AS p
      INNER JOIN area AS a
        ON a.narea = p.narea
      LEFT JOIN service_line AS sl
        ON sl.nsline = a.nsline
      WHERE p.nutilizador = :utilizadorId
      ORDER BY LOWER(a.area) ASC, a.narea ASC
    `,
    {
      replacements: { utilizadorId: Number(utilizadorId) },
      type: QueryTypes.SELECT,
    },
  );
};

const buildPreferenceAreas = async (accountId) => {
  const utilizadorId = accountId ? await getUtilizadorIdByAccountId(accountId) : null;

  const [areasRows, selectedRows] = await Promise.all([
    sequelize.query(
      `
        SELECT
          a.narea,
          a.area,
          a.a_desc,
          sl.sline,
          COUNT(DISTINCT bpa.nbadge) AS total_badges
        FROM area AS a
        LEFT JOIN service_line AS sl
          ON sl.nsline = a.nsline
        LEFT JOIN b_pertence_a AS bpa
          ON bpa.narea = a.narea
        GROUP BY a.narea, a.area, a.a_desc, sl.sline
        ORDER BY LOWER(a.area) ASC, a.narea ASC
      `,
      {
        type: QueryTypes.SELECT,
      },
    ),
    getSelectedAreaRowsByUtilizadorId(utilizadorId),
  ]);

  const selectedAreaIds = new Set(selectedRows.map((row) => Number(row.narea)));

  return areasRows.map((row) => ({
    id: Number(row.narea),
    name: row.area || 'Area',
    description: row.a_desc || '',
    serviceLine: row.sline || '',
    badgeCount: Number(row.total_badges) || 0,
    selected: selectedAreaIds.has(Number(row.narea)),
  }));
};

const buildUserPreferences = async (accountId) => {
  const utilizadorId = await getUtilizadorIdByAccountId(accountId);
  if (!utilizadorId) {
    return [];
  }

  const rows = await getSelectedAreaRowsByUtilizadorId(utilizadorId);
  return rows.map((row) => ({
    id: Number(row.narea),
    name: row.area || 'Area',
    description: row.a_desc || '',
    serviceLine: row.sline || '',
  }));
};

const saveUserPreferences = async (accountId, areaIds) => {
  const parsedAreaIds = [...new Set(
    (Array.isArray(areaIds) ? areaIds : [])
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0),
  )];

  if (parsedAreaIds.length === 0) {
    const error = new Error('At least one area is required.');
    error.statusCode = 400;
    throw error;
  }

  const utilizadorId = await getUtilizadorIdByAccountId(accountId);
  if (!utilizadorId) {
    const error = new Error('User not found for account.');
    error.statusCode = 404;
    throw error;
  }

  const existingAreaRows = await sequelize.query(
    `
      SELECT narea
      FROM area
      WHERE narea IN (:areaIds)
    `,
    {
      replacements: { areaIds: parsedAreaIds },
      type: QueryTypes.SELECT,
    },
  );

  const existingAreaIds = new Set(existingAreaRows.map((row) => Number(row.narea)));
  if (existingAreaIds.size !== parsedAreaIds.length) {
    const error = new Error('One or more selected areas are invalid.');
    error.statusCode = 400;
    throw error;
  }

  const transaction = await sequelize.transaction();
  try {
    await sequelize.query(
      `
        DELETE FROM preferencias
        WHERE nutilizador = :utilizadorId
      `,
      {
        replacements: { utilizadorId },
        type: QueryTypes.DELETE,
        transaction,
      },
    );

    for (const areaId of parsedAreaIds) {
      await sequelize.query(
        `
          INSERT INTO preferencias (nutilizador, narea)
          VALUES (:utilizadorId, :areaId)
          ON CONFLICT (narea, nutilizador) DO NOTHING
        `,
        {
          replacements: { utilizadorId, areaId },
          type: QueryTypes.INSERT,
          transaction,
        },
      );
    }

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }

  return buildUserPreferences(accountId);
};

const buildBadgeSuggestions = async (accountId, limit = 3) => {
  try { await autoRejectExpiredRequests(); } catch (e) { console.error('Error auto-rejecting expired requests:', e); }
  try { await adminBadgeModel.checkAndExpireBadges(); } catch (e) { console.error('Error checking expired badges:', e); }
  const safeLimit = Number.isInteger(Number(limit)) && Number(limit) > 0 ? Number(limit) : 3;
  const utilizadorId = await getUtilizadorIdByAccountId(accountId);
  if (!utilizadorId) {
    return [];
  }

  const preferredAreas = await getSelectedAreaRowsByUtilizadorId(utilizadorId);
  if (preferredAreas.length === 0) {
    return [];
  }

  const preferredAreaIds = preferredAreas.map((area) => Number(area.narea));

  const [candidateRows, obtainedRows, requestRows] = await Promise.all([
    sequelize.query(
      `
        SELECT DISTINCT ON (b.nbadge)
          b.nbadge,
          b.b_nome,
          a.narea,
          a.area,
          n.nivel
        FROM area AS a
        INNER JOIN nivel AS n
          ON n.narea = a.narea
        INNER JOIN nivel_contem_b AS ncb
          ON ncb.nnivel = n.nnivel
        INNER JOIN badge AS b
          ON b.nbadge = ncb.nbadge
        WHERE a.narea IN (:areaIds)
          AND (b.validade IS NULL OR b.validade > CURRENT_DATE)
        ORDER BY b.nbadge ASC
      `,
      {
        replacements: { areaIds: preferredAreaIds },
        type: QueryTypes.SELECT,
      },
    ),
    sequelize.query(
      `
        SELECT nbadge
        FROM c_obtem_b
        WHERE nutilizador = :utilizadorId
      `,
      {
        replacements: { utilizadorId },
        type: QueryTypes.SELECT,
      },
    ),
    sequelize.query(
      `
        SELECT DISTINCT ON (p.nbadge)
          p.nbadge,
          e.estado
        FROM pedidos AS p
        INNER JOIN estado AS e
          ON e.nestado = p.estado
        WHERE p.nutilizador = :utilizadorId
        ORDER BY p.nbadge, p.data_submissao DESC, p.npedido DESC
      `,
      {
        replacements: { utilizadorId },
        type: QueryTypes.SELECT,
      },
    ),
  ]);

  const obtainedBadgeIds = new Set(obtainedRows.map((row) => Number(row.nbadge)));
  const requestStatusByBadge = new Map(
    requestRows.map((row) => [Number(row.nbadge), mapPedidoEstadoToLearningPathStatus(row.estado)]),
  );

  const candidateRowsByArea = new Map();
  for (const row of candidateRows) {
    const areaId = Number(row.narea);
    if (!candidateRowsByArea.has(areaId)) {
      candidateRowsByArea.set(areaId, []);
    }

    candidateRowsByArea.get(areaId).push(row);
  }

  for (const rows of candidateRowsByArea.values()) {
    rows.sort((left, right) => {
      const leftTemplate = resolveBadgeTemplate(left.nivel);
      const rightTemplate = resolveBadgeTemplate(right.nivel);
      return rightTemplate.points - leftTemplate.points;
    });
  }

  const suggestions = [];
  const suggestedBadgeIds = new Set();
  for (let index = 0; index < preferredAreas.length; index += 1) {
    if (suggestions.length >= safeLimit) {
      break;
    }

    const area = preferredAreas[index];
    const areaRows = candidateRowsByArea.get(Number(area.narea)) || [];

    const matchedRow = areaRows.find((row) => {
      const badgeId = Number(row.nbadge);
      if (obtainedBadgeIds.has(badgeId)) {
        return false;
      }

      const latestRequestStatus = requestStatusByBadge.get(badgeId);
      return !hasActiveBadgeRequest(latestRequestStatus);
    });

    if (!matchedRow) {
      continue;
    }

    const template = resolveBadgeTemplate(matchedRow.nivel);
    suggestedBadgeIds.add(Number(matchedRow.nbadge));
    suggestions.push({
      title: matchedRow.b_nome || matchedRow.area || area.area || 'Badge',
      subtitleKey: template.levelKey,
      accent: suggestionAccentPalette[index % suggestionAccentPalette.length],
      badgeDbId: Number(matchedRow.nbadge),
    });
  }

  if (suggestions.length < safeLimit) {
    for (let areaIndex = 0; areaIndex < preferredAreas.length; areaIndex += 1) {
      if (suggestions.length >= safeLimit) {
        break;
      }

      const area = preferredAreas[areaIndex];
      const areaRows = candidateRowsByArea.get(Number(area.narea)) || [];

      for (const row of areaRows) {
        if (suggestions.length >= safeLimit) {
          break;
        }

        const badgeId = Number(row.nbadge);
        if (suggestedBadgeIds.has(badgeId) || obtainedBadgeIds.has(badgeId)) {
          continue;
        }

        const latestRequestStatus = requestStatusByBadge.get(badgeId);
        if (hasActiveBadgeRequest(latestRequestStatus)) {
          continue;
        }

        const template = resolveBadgeTemplate(row.nivel);
        suggestedBadgeIds.add(badgeId);
        suggestions.push({
          title: row.b_nome || row.area || area.area || 'Badge',
          subtitleKey: template.levelKey,
          accent: suggestionAccentPalette[suggestions.length % suggestionAccentPalette.length],
          badgeDbId: badgeId,
        });
      }
    }
  }

  return suggestions;
};

const requestBadgeAcquisition = async (accountId, badgeId) => {
  try { await autoRejectExpiredRequests(); } catch (e) { console.error('Error auto-rejecting expired requests:', e); }
  try { await adminBadgeModel.checkAndExpireBadges(); } catch (e) { console.error('Error checking expired badges:', e); }
  const parsedBadgeId = Number(badgeId);
  if (!Number.isInteger(parsedBadgeId) || parsedBadgeId <= 0) {
    const error = new Error('Invalid badge id.');
    error.statusCode = 400;
    throw error;
  }

  const utilizadorId = await getUtilizadorIdByAccountId(accountId);
  if (!utilizadorId) {
    const error = new Error('User not found for account.');
    error.statusCode = 404;
    throw error;
  }

  const [badgeExists] = await sequelize.query(
    `
      SELECT nbadge, validade
      FROM badge
      WHERE nbadge = :badgeId
      LIMIT 1
    `,
    {
      replacements: { badgeId: parsedBadgeId },
      type: QueryTypes.SELECT,
    },
  );

  if (!badgeExists) {
    const error = new Error('Badge not found.');
    error.statusCode = 404;
    throw error;
  }

  if (badgeExists.validade && new Date(badgeExists.validade) <= new Date()) {
    const error = new Error('Esta badge já expirou e não pode ser solicitada.');
    error.statusCode = 410;
    throw error;
  }

  await ensureRequirementsForBadges([parsedBadgeId]);

  const [alreadyObtained] = await sequelize.query(
    `
      SELECT 1
      FROM c_obtem_b
      WHERE nutilizador = :utilizadorId
        AND nbadge = :badgeId
      LIMIT 1
    `,
    {
      replacements: { utilizadorId, badgeId: parsedBadgeId },
      type: QueryTypes.SELECT,
    },
  );

  if (alreadyObtained) {
    return { status: 'obtido', requestId: null };
  }

  const candidaturaEstadoId = await ensureEstadoId('candidatura_em_progresso');
  const [existingRequest] = await sequelize.query(
    `
      SELECT p.npedido, e.estado
      FROM pedidos AS p
      INNER JOIN estado AS e
        ON e.nestado = p.estado
      WHERE p.nutilizador = :utilizadorId
        AND p.nbadge = :badgeId
      ORDER BY p.data_submissao DESC, p.npedido DESC
      LIMIT 1
    `,
    {
      replacements: { utilizadorId, badgeId: parsedBadgeId },
      type: QueryTypes.SELECT,
    },
  );

  if (existingRequest) {
    const existingRequestId = Number(existingRequest.npedido);
    const existingEstado = normalizePedidoEstado(existingRequest.estado);
    if (existingEstado === pedidoEstados.aprovado) {
      return { status: 'obtido', requestId: existingRequestId };
    }

    if (isEstadoEmValidacao(existingEstado)) {
      return { status: 'pendente-tm', requestId: existingRequestId };
    }

    if (
      existingEstado !== pedidoEstados.candidaturaEmProgresso
      && existingEstado !== pedidoEstados.evidenciasInsuficientes
      && existingEstado !== pedidoEstados.rejeitado
    ) {
      const currentStatus = mapPedidoEstadoToLearningPathStatus(existingEstado);
      return {
        status: currentStatus === 'visualizar' ? 'candidatura_em_progresso' : currentStatus,
        requestId: existingRequestId,
      };
    }

    const nextStatus = pedidoEstados.emValidacaoTm;
    const nextEstadoId = await ensureEstadoId(nextStatus);

    await sequelize.query(
      `
        UPDATE pedidos
        SET estado = :estadoId,
            data_submissao = CURRENT_DATE,
            data_limite = CURRENT_DATE + INTERVAL '3 months'
        WHERE npedido = :pedidoId
      `,
      {
        replacements: {
          estadoId: nextEstadoId,
          pedidoId: Number(existingRequest.npedido),
        },
        type: QueryTypes.UPDATE,
      },
    );

    // Send email confirmation of submission to TM
    try {
      const [consultorInfo] = await sequelize.query(
        'SELECT u.nome, u.email FROM utilizador u WHERE u.nutilizador = :utilizadorId LIMIT 1',
        {
          replacements: { utilizadorId: Number(utilizadorId) },
          type: QueryTypes.SELECT,
        }
      );
      const [badgeInfo] = await sequelize.query(
        'SELECT b_nome FROM badge WHERE nbadge = :badgeId LIMIT 1',
        {
          replacements: { badgeId: Number(parsedBadgeId) },
          type: QueryTypes.SELECT,
        }
      );
      if (consultorInfo?.email) {
        await sendEmail({
          to: consultorInfo.email,
          subject: 'Pedido de Badge Enviado - PINT',
          html: emailTemplates.requestSubmittedToTM({
            userName: consultorInfo.nome || 'Consultor',
            badgeName: badgeInfo?.b_nome || 'Badge',
          }),
        });
      }
    } catch (emailError) {
      console.error('Failed to send request submission email.', emailError);
    }

    return { status: 'pendente-tm', requestId: existingRequestId };
  }

  const [createdRequest] = await sequelize.query(
    `
      INSERT INTO pedidos (nbadge, nutilizador, estado, data_submissao, data_limite)
      VALUES (:badgeId, :utilizadorId, :estadoId, CURRENT_DATE, CURRENT_DATE + INTERVAL '3 months')
      RETURNING npedido
    `,
    {
      replacements: {
        badgeId: parsedBadgeId,
        utilizadorId,
        estadoId: candidaturaEstadoId,
      },
      type: QueryTypes.SELECT,
    },
  );

  return { status: 'candidatura_em_progresso', requestId: Number(createdRequest?.npedido) || null };
};

const mapReminder = (reminder) => ({
  id: reminder.id,
  accountId: reminder.accountId,
  title: reminder.title,
  description: reminder.description,
  date: reminder.date,
  color: reminder.color,
});

const saveEvidences = async (accountId, pedidoId, nreq, fileMeta) => {
  const parsedAccountId = Number(accountId);
  const parsedPedido = Number(pedidoId);
  let parsedNreq = Number(nreq) || null;

  if (!Number.isInteger(parsedAccountId) || parsedAccountId <= 0) {
    const error = new Error('Invalid account id.');
    error.statusCode = 400;
    throw error;
  }

  if (!Number.isInteger(parsedPedido) || parsedPedido <= 0) {
    const error = new Error('Invalid pedido id.');
    error.statusCode = 400;
    throw error;
  }

  const utilizadorId = await getUtilizadorIdByAccountId(parsedAccountId);
  if (!utilizadorId) {
    const error = new Error('User not found for account.');
    error.statusCode = 404;
    throw error;
  }

  const [requestRow] = await sequelize.query(
    `
      SELECT npedido, nbadge
      FROM pedidos
      WHERE npedido = :pedidoId
        AND nutilizador = :utilizadorId
      LIMIT 1
    `,
    {
      replacements: { pedidoId: parsedPedido, utilizadorId },
      type: QueryTypes.SELECT,
    },
  );

  if (!requestRow) {
    const error = new Error('Request not found for account.');
    error.statusCode = 404;
    throw error;
  }

  if (Number.isInteger(parsedNreq) && parsedNreq > 0) {
    const [requirementRow] = await sequelize.query(
      `
        SELECT 1
        FROM requisitos
        WHERE nreq = :nreq
          AND nbadge = :badgeId
        LIMIT 1
      `,
      {
        replacements: {
          nreq: parsedNreq,
          badgeId: Number(requestRow.nbadge),
        },
        type: QueryTypes.SELECT,
      },
    );

    if (!requirementRow) {
      parsedNreq = null;
    }
  }

  const nevidencia = String(fileMeta.filename || fileMeta.originalName || 'evidence').slice(0, 50);
  const formato = String(fileMeta.formato || '').slice(0, 50);

  const [inserted] = await sequelize.query(
    `
      INSERT INTO evidencias (nevidencia, e_data_submissao, formato, nreq, npedido)
      VALUES (:nevidencia, CURRENT_DATE, :formato, :nreq, :npedido)
      RETURNING nevidencias, nevidencia, formato, nreq, npedido
    `,
    {
      replacements: {
        nevidencia,
        formato,
        nreq: parsedNreq,
        npedido: parsedPedido,
      },
      type: QueryTypes.SELECT,
    },
  );

  return inserted || {
    nevidencia,
    formato,
    nreq: parsedNreq,
    npedido: parsedPedido,
  };
};

const getPedidoDetail = async (accountId, pedidoId) => {
  const parsedPedidoId = Number(pedidoId);
  if (!Number.isInteger(parsedPedidoId) || parsedPedidoId <= 0) {
    return null;
  }

  const utilizadorId = await getUtilizadorIdByAccountId(accountId);
  if (!utilizadorId) {
    return null;
  }

  const [row] = await sequelize.query(
    `
      SELECT
        p.npedido,
        p.data_submissao,
        p.data_limite,
        p.descricao,
        e.estado AS estado_nome,
        u.nome AS consultor_nome,
        b.nbadge,
        b.b_nome,
        b.b_descricao,
        b.pontos AS badge_pontos,
        b.imagem AS badge_imagem,
        b.validade,
        t.tipo AS tipo_nome,
        n.nivel AS nivel_nome,
        a.area AS area_nome,
        sl.sline AS sline_nome,
        lp.lpath AS lpath_nome
      FROM pedidos AS p
      INNER JOIN estado AS e ON e.nestado = p.estado
      INNER JOIN utilizador AS u ON u.nutilizador = p.nutilizador
      LEFT JOIN badge AS b ON b.nbadge = p.nbadge
      LEFT JOIN tipo AS t ON t.ntipo = b.ntipo
      LEFT JOIN nivel_contem_b AS ncb ON ncb.nbadge = b.nbadge
      LEFT JOIN nivel AS n ON n.nnivel = ncb.nnivel
      LEFT JOIN area AS a ON a.narea = n.narea
      LEFT JOIN service_line AS sl ON sl.nsline = a.nsline
      LEFT JOIN learning_path AS lp ON lp.nlpath = sl.nlpath
      WHERE p.npedido = :pedidoId
        AND p.nutilizador = :utilizadorId
      LIMIT 1
    `,
    {
      replacements: { pedidoId: parsedPedidoId, utilizadorId },
      type: QueryTypes.SELECT,
    },
  );

  if (!row) {
    return null;
  }

  const badgeId = Number(row.nbadge);
  const isSpecial = isSpecialTypeName(row.tipo_nome);
  const template = resolveBadgeTemplate(row.nivel_nome, 0, row.tipo_nome);
  const levelTitle = normalizeLevelTitle(row.nivel_nome) || 'Intermédio';
  const status = mapPedidoEstadoToMyRequestStatus(row.estado_nome);
  const resolvedPoints = Number(row.badge_pontos) > 0 ? Number(row.badge_pontos) : template.points;

  await ensureRequirementsForBadges([badgeId]);
  const requirementsByBadge = await loadRequirementsByBadgeIds([badgeId]);
  const badgeRequirements = clone(requirementsByBadge.get(badgeId) || []);

  const evidenceRows = await sequelize.query(
    `
      SELECT nevidencias, nreq, nevidencia, formato
      FROM evidencias
      WHERE npedido = :pedidoId
      ORDER BY nreq ASC, nevidencias ASC
    `,
    {
      replacements: { pedidoId: parsedPedidoId },
      type: QueryTypes.SELECT,
    },
  );

  const evidenceByReq = new Map();
  const unscopedAttachments = [];

  for (const erow of evidenceRows) {
    const requirementId = Number(erow.nreq);
    const extension = String(erow.formato || '').trim().toLowerCase();
    const labelBase = String(erow.nevidencia || 'evidencia').trim();
    const label = extension && !labelBase.toLowerCase().endsWith(`.${extension}`)
      ? `${labelBase}.${extension}`
      : labelBase;
    const attachment = {
      id: `evidence-${Number(erow.nevidencias) || label}`,
      evidenceId: Number(erow.nevidencias) || null,
      type: extension === 'pdf' ? 'pdf' : 'file',
      label,
    };

    if (!Number.isInteger(requirementId) || requirementId <= 0) {
      unscopedAttachments.push(attachment);
      continue;
    }

    if (!evidenceByReq.has(requirementId)) {
      evidenceByReq.set(requirementId, []);
    }

    evidenceByReq.get(requirementId).push(attachment);
  }

  for (const requirement of badgeRequirements) {
    const reqNum = Number(String(requirement.id || '').replace('req-', ''));
    const attachments = evidenceByReq.get(reqNum) || [];
    requirement.files = attachments.length;
    requirement.attachments = attachments;
  }

  if (badgeRequirements.length > 0 && unscopedAttachments.length > 0) {
    badgeRequirements[0].files = Number(badgeRequirements[0].files || 0) + unscopedAttachments.length;
    badgeRequirements[0].attachments = [...(badgeRequirements[0].attachments || []), ...unscopedAttachments];
  }

  const motiveRows = await sequelize.query(
    `
      SELECT
        m.nutilizador,
        m.motivo_desc,
        u.nome AS autor_nome,
        u.permissoes AS autor_permissoes
      FROM motivo AS m
      INNER JOIN utilizador AS u ON u.nutilizador = m.nutilizador
      WHERE m.npedido = :pedidoId
    `,
    {
      replacements: { pedidoId: parsedPedidoId },
      type: QueryTypes.SELECT,
    },
  );

  let reviewerName = null;
  let reviewerDate = null;
  let reviewerNote = null;

  if (motiveRows.length > 0) {
    const lastMotive = motiveRows[motiveRows.length - 1];
    reviewerName = lastMotive.autor_nome || null;
    reviewerNote = lastMotive.motivo_desc || null;
    reviewerDate = formatShortDate(row.data_submissao);
  }

  return {
    id: parsedPedidoId,
    badge: row.b_nome || row.area_nome || 'Badge',
    levelLabel: `Nível ${levelTitle}`,
    area: row.lpath_nome || 'Jornada Técnica',
    path: row.sline_nome || 'Service Line',
    status,
    points: resolvedPoints,
    badgeImage: resolveBadgeImage(row.badge_imagem, template.badgeImage, isSpecial),
    expiresAt: formatDate(row.validade),
    submittedBy: row.consultor_nome || 'Utilizador',
    submissionDate: formatShortDate(row.data_submissao),
    requirements: badgeRequirements,
    reviewerName,
    reviewerDate,
    reviewerNote,
  };
};

export const consultorModel = {
  async getCatalogBadges(includeExpired = false) {
    try { await adminBadgeModel.checkAndExpireBadges(); } catch (e) { console.error('Error checking expired badges:', e); }
    const whereClause = includeExpired ? '' : 'WHERE b.validade IS NULL OR b.validade > CURRENT_DATE';
    const rawBadges = await sequelize.query(
      `
        SELECT
          b.nbadge,
          b.b_nome,
          b.b_descricao,
          b.pontos,
          b.imagem,
          b.validade,
          t.tipo AS tipo,
          n.nnivel,
          a.area,
          n.nivel,
          sl.sline
        FROM badge AS b
        LEFT JOIN tipo AS t
          ON b.ntipo = t.ntipo
        LEFT JOIN nivel_contem_b AS ncb
          ON b.nbadge = ncb.nbadge
        LEFT JOIN nivel AS n
          ON ncb.nnivel = n.nnivel
        LEFT JOIN area AS a
          ON n.narea = a.narea
        LEFT JOIN service_line AS sl
          ON a.nsline = sl.nsline
        ${whereClause}
        ORDER BY b.nbadge ASC
      `,
      { type: QueryTypes.SELECT }
    );

    const items = rawBadges.map((row) => {
      const isSpecial = isSpecialTypeName(row.tipo);
      const template = resolveBadgeTemplate(row.nivel, 0, row.tipo);
      const resolvedPoints = Number(row.pontos) > 0 ? Number(row.pontos) : template.points;
      const name = row.b_nome || row.area || 'Badge';

      return {
        id: `badge-${row.nbadge}`,
        badgeDbId: Number(row.nbadge),
        levelId: row.nnivel ? Number(row.nnivel) : null,
        area: row.area || row.b_nome || 'Diversos',
        name,
        description: row.b_descricao || '',
        stateId: 'candidatura_aberta',
        status: 'visualizar',
        levelKey: isSpecial ? null : template.levelKey,
        typeId: isSpecial ? 'special' : template.levelKey,
        isSpecial,
        points: resolvedPoints,
        badgeImage: resolveBadgeImage(row.imagem, template.badgeImage, isSpecial),
        learningPathName: 'Jornada Técnica',
        serviceLineName: row.sline || 'Application Operations',
        validade: row.validade || null,
      };
    });

    const badgeIds = items.map((item) => item.badgeDbId).filter(Boolean);
    const imageMap = await loadBadgeImagesBatch(badgeIds);

    for (const item of items) {
      if (imageMap[item.badgeDbId]) {
        item.badgeImage = imageMap[item.badgeDbId];
      }
    }

    return items;
  },

  async getLearningPaths(accountId) {
    const data = await buildLearningPaths(accountId);
    return clone(data);
  },

  async getMyBadges(accountId) {
    const data = await buildMyBadges(accountId);
    return clone(data);
  },

  async requestBadgeAcquisition(accountId, badgeId) {
    const data = await requestBadgeAcquisition(accountId, badgeId);
    return clone(data);
  },

  async getPreferenceAreas(accountId) {
    const data = await buildPreferenceAreas(accountId);
    return clone(data);
  },

  async getPreferences(accountId) {
    const data = await buildUserPreferences(accountId);
    return clone(data);
  },

  async savePreferences(accountId, areaIds) {
    const data = await saveUserPreferences(accountId, areaIds);
    return clone(data);
  },

  async getBadgeSuggestions(accountId, limit) {
    const data = await buildBadgeSuggestions(accountId, limit);
    return clone(data);
  },

  async getMyRequests(accountId) {
    const data = await buildMyRequests(accountId);
    return clone(data);
  },

  async getPedidoDetail(accountId, pedidoId) {
    const data = await getPedidoDetail(accountId, pedidoId);
    return data ? clone(data) : null;
  },

  async getRankingConsultores() {
    const data = await buildRankingConsultores();
    return clone(data);
  },

  async getReminders(accountId) {
    const reminders = await Reminder.findAll({
      where: { accountId: Number(accountId) },
      order: [['date', 'ASC']],
    });

    return reminders.map(mapReminder);
  },

  async createReminder(accountId, payload) {
    const reminder = await Reminder.create({
      accountId: Number(accountId),
      title: payload.title.trim(),
      description: payload.description.trim(),
      date: payload.date,
      color: payload.color,
    });
    return mapReminder(reminder);
  },

  async updateReminder(id, accountId, payload) {
    const reminder = await Reminder.findOne({ where: { id: Number(id), accountId: Number(accountId) } });
    if (!reminder) {
      return null;
    }

    await reminder.update({
      title: payload.title.trim(),
      description: payload.description.trim(),
      date: payload.date,
      color: payload.color,
    });

    return mapReminder(reminder);
  },

  async deleteReminder(id, accountId) {
    const deletedRows = await Reminder.destroy({ where: { id: Number(id), accountId: Number(accountId) } });
    return deletedRows > 0;
  },

  async getProfileData(accountId) {
    const data = await buildProfileData(accountId);
    return clone(data);
  },

  async updateProfileData(accountId, updates) {
    const fields = {};
    if (typeof updates.nome === 'string') {
      fields.nome = updates.nome.trim();
    }
    if (Object.keys(fields).length === 0) {
      return { updated: false };
    }
    await Account.update(fields, { where: { id: Number(accountId) } });
    return { updated: true };
  },

  async saveEvidences(accountId, pedidoId, nreq, fileMeta) {
    const data = await saveEvidences(accountId, pedidoId, nreq, fileMeta);
    return clone(data);
  },

  async getBadgeRequirements(badgeId) {
    const parsedBadgeId = Number(badgeId);
    if (!Number.isInteger(parsedBadgeId) || parsedBadgeId <= 0) {
      return [];
    }

    const [badgeRow] = await sequelize.query(
      `
        SELECT t.tipo
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
    );

    if (badgeRow && isSpecialTypeName(badgeRow.tipo)) {
      const specialRequirementsByBadge = await loadSpecialRequirementsByBadgeIds([parsedBadgeId]);
      const specialRequirements = specialRequirementsByBadge.get(parsedBadgeId) || [];

      if (specialRequirements.length > 0) {
        return specialRequirements;
      }

      return [];
    }

    const rows = await sequelize.query(
      `
        SELECT nreq, requisito, r_descricao, imagem
        FROM requisitos
        WHERE nbadge = :badgeId
        ORDER BY nreq ASC
      `,
      {
        replacements: { badgeId: parsedBadgeId },
        type: QueryTypes.SELECT,
      },
    );

    return rows.map((row) => ({
      id: `req-${Number(row.nreq)}`,
      title: row.requisito || 'Requisito',
      description: row.r_descricao || 'Texto de suporte do requisito associado a candidatura.',
      image: row.imagem || null,
      files: 0,
      attachments: [],
    }));
  },

  sendAllExpirationNotifications,
};
