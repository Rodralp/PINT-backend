import { QueryTypes, Op } from 'sequelize';
import { Reminder } from './sql/Reminder.js';
import { Account } from './sql/Account.js';
import { Badge } from './sql/Badge.js';
import { BadgeTrigger } from './sql/BadgeTrigger.js';
import { CObtemBadge } from './sql/CObtemBadge.js';
import { Pedido } from './sql/Pedido.js';
import { Estado } from './sql/Estado.js';
import { Requisito } from './sql/Requisito.js';
import { Evidencia } from './sql/Evidencia.js';
import { Motivo } from './sql/Motivo.js';
import { Tipo } from './sql/Tipo.js';
import { Vitrine } from './sql/Vitrine.js';
import { Nivel } from './sql/Nivel.js';
import { NivelContemBadge } from './sql/NivelContemBadge.js';
import { PedidoHistorico } from './sql/PedidoHistorico.js';
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

  const rows = await BadgeTrigger.findAll({
    where: { nbadge: { [Op.in]: normalizedBadgeIds } },
    attributes: ['nbadge', 'trigger_tipo', 'trigger_valor'],
    order: [['nbadge', 'ASC'], ['trigger_tipo', 'ASC']],
    raw: true,
  });

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

        await PedidoHistorico.create({
          npedido: requestId,
          nestado: approvedEstadoId,
          nutilizador: Number(utilizadorId),
          data_estado: new Date(),
          descricao: 'Badge especial atribuída automaticamente por trigger.',
        }, { transaction });

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

export const syncSpecialBadgesForAllConsultors = async () => {
  const consultorRows = await Account.findAll({
    where: {
      status: 'ativo',
      permissoes: { [Op.iLike]: '%consultor%' },
    },
    attributes: ['id'],
    raw: true,
  });

  const ids = consultorRows.map((r) => Number(r.id)).filter((id) => Number.isInteger(id) && id > 0);

  for (const id of ids) {
    try {
      await syncSpecialBadgesForConsultor(id);
    } catch (error) {
      console.error('Failed to sync special badges for consultor', id, error);
    }
  }
};

const getUtilizadorIdByAccountId = async (accountId) => {
  const user = await Account.findByPk(Number(accountId), { attributes: ['id'] });
  return user?.id ? Number(user.id) : null;
};

const ensureEstadoId = async (estadoNome) => {
  const [estado] = await Estado.findOrCreate({
    where: sequelize.where(sequelize.fn('LOWER', sequelize.col('estado')), estadoNome.toLowerCase()),
    defaults: { estado: estadoNome },
  });
  return Number(estado.nestado);
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

  await sequelize.query(
    `
      INSERT INTO pedido_historico (npedido, nestado, nutilizador, data_estado, descricao)
      SELECT npedido, :rejectedId, NULL, NOW(), :defaultDescription
      FROM pedidos
      WHERE data_limite IS NOT NULL
        AND data_limite <= CURRENT_DATE
        AND estado = :rejectedId
    `,
    {
      replacements: {
        rejectedId,
        defaultDescription: AUTO_REJECTION_NOTE,
      },
      type: QueryTypes.INSERT,
    },
  );
};

const EXPIRATION_NOTIFICATION_THRESHOLD_DAYS = Number(globalThis.process?.env?.EXPIRATION_NOTIFICATION_THRESHOLD_DAYS) || 30;

const sendAllExpirationNotifications = async () => {
  try {
    const expiringBadges = await adminBadgeModel.getExpiringSoonBadges(EXPIRATION_NOTIFICATION_THRESHOLD_DAYS);

    if (!expiringBadges || expiringBadges.length === 0) {
      return;
    }

    const notifiedSet = new Set();

    const adminRows = await Account.findAll({
      where: { status: 'ativo', permissoes: { [Op.iLike]: '%admin-gestor%' } },
      attributes: ['id'],
      raw: true,
    });
    const adminIds = adminRows.map((r) => Number(r.id)).filter((id) => Number.isInteger(id) && id > 0);

    const tmRows = await Account.findAll({
      where: { status: 'ativo', permissoes: { [Op.iLike]: '%talent-manager%' } },
      attributes: ['id'],
      raw: true,
    });
    const tmIds = tmRows.map((r) => Number(r.id)).filter((id) => Number.isInteger(id) && id > 0);

    for (const badge of expiringBadges) {
      const validade = new Date(badge.validade);
      const today = new Date();
      const daysUntilExpiration = Math.ceil((validade - today) / (1000 * 60 * 60 * 24));

      if (daysUntilExpiration <= 0 || daysUntilExpiration > EXPIRATION_NOTIFICATION_THRESHOLD_DAYS) {
        continue;
      }

      const recipientSet = new Set();

      for (const id of adminIds) recipientSet.add(id);
      for (const id of tmIds) recipientSet.add(id);

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

  const rows = await Requisito.findAll({
    where: { nbadge: { [Op.in]: normalizedBadgeIds } },
    attributes: ['nbadge', 'nreq', 'requisito', 'r_descricao', 'imagem'],
    order: [['nbadge', 'ASC'], ['nreq', 'ASC']],
    raw: true,
  });

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
        COALESCE(dsl.sline, 'Application Operations') AS "serviceLine"
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

  const consultorIds = rows.map((row) => Number(row.id)).filter(Boolean);

  const allSlStats = consultorIds.length > 0
    ? await sequelize.query(
        `
          SELECT
            cb.nutilizador,
            COALESCE(sl.sline, 'Application Operations') AS serviceLine,
            COUNT(DISTINCT b.nbadge) AS badges,
            SUM(COALESCE(NULLIF(cb.pontos_obtidos, 0), NULLIF(b.pontos, 0), 0)) AS points
          FROM c_obtem_b AS cb
          INNER JOIN badge AS b ON b.nbadge = cb.nbadge
          LEFT JOIN b_pertence_sl AS bps ON bps.nbadge = b.nbadge
          LEFT JOIN service_line AS sl ON sl.nsline = bps.nsline
          WHERE cb.nutilizador IN (:ids)
          GROUP BY cb.nutilizador, sl.sline
        `,
        {
          replacements: { ids: consultorIds },
          type: QueryTypes.SELECT,
        },
      )
    : [];

  const statsByUser = new Map();
  for (const stat of allSlStats) {
    const userId = Number(stat.nutilizador);
    if (!statsByUser.has(userId)) statsByUser.set(userId, []);
    statsByUser.get(userId).push({
      serviceLine: stat.serviceLine || 'Application Operations',
      badges: Number(stat.badges) || 0,
      points: Number(stat.points) || 0,
    });
  }

  const consultoresWithStats = rows.map((row) => ({
    id: Number(row.id),
    name: row.name,
    email: row.email,
    points: Number(row.points) || 0,
    badges: Number(row.badges) || 0,
    serviceLine: row.serviceLine || 'Application Operations',
    avatar: null,
    serviceLineStats: statsByUser.get(Number(row.id)) || [],
  }));

  const avatarIds = consultoresWithStats.map((c) => c.id).filter(Boolean);
  if (avatarIds.length > 0) {
    try {
      const { utilizadorImagemModel } = await import('./utilizadorImagemModel.js');
      const avatarMap = await utilizadorImagemModel.loadUserImagesBatch(avatarIds);
      for (const c of consultoresWithStats) {
        if (avatarMap[c.id]) c.avatar = avatarMap[c.id];
      }
    } catch { /* no images */ }
  }

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
    throw new Error('Invalid accountId');
  }

  return _buildProfileDataInner(parsedAccountId);
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
        u.localizacao,
        COALESCE(bs.points, 0) AS points,
        COALESCE(bs.badges, 0) AS badges,
        COALESCE(dsl.sline, 'Application Operations') AS "serviceLine",
        COALESCE(DATE(u.data_registo), CURRENT_DATE) AS "joined",
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
    throw new Error('User not found');
  }
  let serviceLineStats = [];
  try {
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
        GROUP BY COALESCE(sl.sline, 'Application Operations')
        ORDER BY COUNT(DISTINCT b.nbadge) DESC, SUM(COALESCE(NULLIF(cb.pontos_obtidos, 0), NULLIF(b.pontos, 0), 0)) DESC
      `,
      {
        replacements: { accountId: parsedAccountId },
        type: QueryTypes.SELECT,
      },
    );
    serviceLineStats = (serviceLineRows || []).map((r) => ({
      serviceLine: r.serviceline || r.serviceLine || 'Application Operations',
      badges: Number(r.badges) || 0,
      points: Number(r.points) || 0,
    }));
  } catch (e) {
    console.error('Profile: failed to load service line stats:', e.message);
  }

  let certificationsItems = [];
  try {
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
    certificationsItems = (certRows || []).map((r) => {
      const template = typeof resolveBadgeTemplate === 'function'
        ? resolveBadgeTemplate(r.nivel, 0, r.tipo)
        : { levelKey: 'badge_level_specialist' };
      return {
        title: r.b_nome || r.nivel || 'Badge',
        levelKey: template.levelKey || 'badge_level_specialist',
      };
    });
  } catch (e) {
    console.error('Profile: failed to load certifications:', e.message);
  }

  let requestCount = 0;
  try {
    requestCount = await Pedido.count({
      where: { nutilizador: parsedAccountId },
    });
  } catch (e) {
    console.error('Profile: failed to count requests:', e.message);
  }

  let activityItems = [];
  try {
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
    activityItems = (activityRows || []).map((row) => ({
      type: row.activity_type || 'badge',
      description: row.description || 'Nova atividade',
      date: formatDate(row.activity_date),
      icon: 'award',
      color: 'gold',
    }));
  } catch (e) {
    console.error('Profile: failed to load activity:', e.message);
  }

  let streakDays = 0;
  try {
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
    streakDays = calculateConsecutiveDayStreak((streakRows || []).map((row) => row.activity_date));
  } catch (e) {
    console.error('Profile: failed to load streak:', e.message);
  }

  let avatar = null;
  try {
    const { utilizadorImagemModel } = await import('./utilizadorImagemModel.js');
    avatar = await utilizadorImagemModel.loadUserImage(parsedAccountId);
  } catch { /* no image */ }

  return {
    ...clone(profileData),
    points: Number(row.points) || 0,
    badges: Number(row.badges) || 0,
    ranking: Number(row.ranking) || 0,
    streakDays,
    location: row.localizacao || '',
    joined: row.joined || '',
    serviceLine: row.serviceLine || 'Application Operations',
    avatar: avatar || null,
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
    activityItems: activityItems.length > 0 ? activityItems : [],
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
      CObtemBadge.findAll({
        where: { nutilizador: utilizadorId },
        attributes: ['nbadge'],
        raw: true,
      }),
      Pedido.findAll({
        where: { nutilizador: utilizadorId },
        include: [{ model: Estado, as: 'estadoInfo', attributes: ['estado'] }],
        attributes: ['npedido', 'nbadge'],
        order: [['data_submissao', 'DESC'], ['npedido', 'DESC']],
        raw: true,
        nest: true,
      }),
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
        status: mapPedidoEstadoToLearningPathStatus(r?.estadoInfo?.estado),
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
      isSpecial,
      levelKey: isSpecial ? 'special' : template.levelKey,
      typeId: isSpecial ? 'special' : (template.levelKey ? `badge_level_${template.levelKey}` : undefined),
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

    const mappedMyBadgeState = mapPedidoEstadoToMyBadgeState(row.estado);
    const mappedMyRequestStatus = mapPedidoEstadoToMyRequestStatus(row.estado);

    items.push({
      id: `badge-${badgeId}-${requestId}`,
      badgeDbId: badgeId,
      name: row.b_nome || row.area || 'Badge',
      area: row.area || row.b_nome || 'Badge',
      stateId: row.estado,
      status: mappedMyBadgeState,
      requestStatus: mappedMyRequestStatus,
      isSpecial,
      levelKey: isSpecial ? 'special' : template.levelKey,
      typeId: isSpecial ? 'special' : (template.levelKey ? `badge_level_${template.levelKey}` : undefined),
      points: Number(row.badge_pontos) || template.points,
      badgeImage: resolveBadgeImage(row.imagem, template.badgeImage, isSpecial),
      date: formatDate(row.data_submissao),
      validade: row.validade || null,
      requirements: badgeRequirements,
    });
  }

  return items;
};

const buildMyRequests = async (accountId) => {
  try {
    await autoRejectExpiredRequests();
  } catch (error) {
    console.error('Error auto-rejecting expired requests:', error);
  }

  const utilizadorId = await getUtilizadorIdByAccountId(accountId);
  if (!utilizadorId) {
    return [];
  }

  const rows = await sequelize.query(
    `
      SELECT
        p.npedido,
        p.nbadge,
        p.data_submissao,
        p.data_limite,
        e.estado,
        b.b_nome,
        b.b_descricao,
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
      ORDER BY p.data_submissao DESC, p.npedido DESC
    `,
    {
      replacements: { utilizadorId },
      type: QueryTypes.SELECT,
    },
  );

  const items = rows.map((row) => {
    const mappedStatus = mapPedidoEstadoToMyRequestStatus(row.estado);
    const template = resolveBadgeTemplate(row.nivel, 0, row.tipo);

    return {
      id: Number(row.npedido),
      name: row.b_nome || 'Badge',
      description: row.b_descricao || '',
      points: Number(row.badge_pontos) || template.points,
      badgeImage: row.imagem || template.badgeImage,
      status: mappedStatus,
      date: formatShortDate(row.data_submissao),
      expiryDate: formatShortDate(row.validade),
      level: normalizeLevelTitle(row.nivel),
      area: row.area || 'Badge',
      serviceLine: 'Service Line',
    };
  });

  return items;
};

const buildBadgeSuggestions = async (accountId, limit = 3) => {
  const utilizadorId = await getUtilizadorIdByAccountId(accountId);
  if (!utilizadorId) {
    return [];
  }

  const preferences = await Preferencia.findAll({
    where: { nutilizador: utilizadorId },
    attributes: ['narea'],
    raw: true,
  });

  const preferenceAreaIds = preferences.map((p) => Number(p.narea)).filter((id) => Number.isInteger(id) && id > 0);

  const query = preferenceAreaIds.length > 0
    ? `
        SELECT
          b.nbadge,
          b.b_nome,
          b.b_descricao,
          b.pontos,
          b.imagem,
          t.tipo,
          n.nivel,
          a.area,
          a.narea
        FROM badge AS b
        LEFT JOIN tipo AS t ON t.ntipo = b.ntipo
        LEFT JOIN nivel_contem_b AS ncb ON ncb.nbadge = b.nbadge
        LEFT JOIN nivel AS n ON n.nnivel = ncb.nnivel
        LEFT JOIN area AS a ON a.narea = n.narea
        WHERE (b.validade IS NULL OR b.validade > CURRENT_DATE)
          AND a.narea IN (:areaIds)
          AND NOT EXISTS (
            SELECT 1 FROM c_obtem_b AS cb
            WHERE cb.nutilizador = :utilizadorId AND cb.nbadge = b.nbadge
          )
          AND NOT EXISTS (
            SELECT 1 FROM pedidos AS p
            WHERE p.nutilizador = :utilizadorId AND p.nbadge = b.nbadge
          )
        ORDER BY b.pontos DESC
        LIMIT :limit
      `
    : `
        SELECT
          b.nbadge,
          b.b_nome,
          b.b_descricao,
          b.pontos,
          b.imagem,
          t.tipo,
          n.nivel,
          a.area,
          a.narea
        FROM badge AS b
        LEFT JOIN tipo AS t ON t.ntipo = b.ntipo
        LEFT JOIN nivel_contem_b AS ncb ON ncb.nbadge = b.nbadge
        LEFT JOIN nivel AS n ON n.nnivel = ncb.nnivel
        LEFT JOIN area AS a ON a.narea = n.narea
        WHERE (b.validade IS NULL OR b.validade > CURRENT_DATE)
          AND NOT EXISTS (
            SELECT 1 FROM c_obtem_b AS cb
            WHERE cb.nutilizador = :utilizadorId AND cb.nbadge = b.nbadge
          )
          AND NOT EXISTS (
            SELECT 1 FROM pedidos AS p
            WHERE p.nutilizador = :utilizadorId AND p.nbadge = b.nbadge
          )
        ORDER BY b.pontos DESC
        LIMIT :limit
      `;

  const rows = await sequelize.query(query, {
    replacements: {
      utilizadorId,
      areaIds: preferenceAreaIds,
      limit: Number(limit) || 3,
    },
    type: QueryTypes.SELECT,
  });

  return (rows || []).map((row, index) => {
    const isSpecial = isSpecialTypeName(row.tipo);
    const template = resolveBadgeTemplate(row.nivel, index, row.tipo);
    return {
      id: `suggestion-${Number(row.nbadge)}`,
      badgeDbId: Number(row.nbadge),
      name: row.b_nome || row.area || 'Badge',
      description: row.b_descricao || '',
      points: Number(row.pontos) || template.points,
      badgeImage: resolveBadgeImage(row.imagem, template.badgeImage, isSpecial),
      levelKey: isSpecial ? 'special' : template.levelKey,
      isSpecial,
      accent: suggestionAccentPalette[index % suggestionAccentPalette.length],
    };
  });
};

const getProfileData = async (accountId) => {
  return buildProfileData(accountId);
};

const updateProfileData = async (accountId, data) => {
  const parsedAccountId = Number(accountId);
  if (!Number.isInteger(parsedAccountId) || parsedAccountId <= 0) {
    throw new Error('Invalid accountId');
  }

  const account = await Account.findByPk(parsedAccountId);
  if (!account) {
    throw new Error('Account not found');
  }

  if (data?.nome) {
    account.nome = String(data.nome).trim().slice(0, 100);
  }

  if (data?.localizacao !== undefined) {
    await sequelize.query(
      `
        UPDATE utilizador
        SET localizacao = :localizacao
        WHERE nutilizador = :accountId
      `,
      {
        replacements: {
          localizacao: String(data.localizacao || '').trim().slice(0, 200),
          accountId: parsedAccountId,
        },
        type: QueryTypes.UPDATE,
      },
    );
  }

  await account.save();

  return { updated: true };
};

const getRankingConsultores = async () => {
  return buildRankingConsultores();
};

const getReminders = async (accountId) => {
  const parsedAccountId = Number(accountId);
  if (!Number.isInteger(parsedAccountId) || parsedAccountId <= 0) {
    return [];
  }

  const reminders = await Reminder.findAll({
    where: { accountId: parsedAccountId },
    order: [['date', 'ASC']],
  });

  return reminders.map((r) => ({
    id: Number(r.id),
    title: r.title,
    description: r.description,
    date: formatShortDate(r.date),
    color: r.color,
  }));
};

const createReminder = async (accountId, { title, description, date, color }) => {
  const parsedAccountId = Number(accountId);
  if (!Number.isInteger(parsedAccountId) || parsedAccountId <= 0) {
    return null;
  }

  const reminder = await Reminder.create({
    title,
    description,
    date,
    color,
    accountId: parsedAccountId,
  });

  return {
    id: Number(reminder.id),
    title: reminder.title,
    description: reminder.description,
    date: formatShortDate(reminder.date),
    color: reminder.color,
  };
};

const updateReminder = async (reminderId, accountId, { title, description, date, color }) => {
  const parsedAccountId = Number(accountId);
  const parsedReminderId = Number(reminderId);
  if (!Number.isInteger(parsedAccountId) || parsedAccountId <= 0) {
    return null;
  }

  const reminder = await Reminder.findOne({
    where: { id: parsedReminderId, accountId: parsedAccountId },
  });

  if (!reminder) {
    return null;
  }

  reminder.title = title;
  reminder.description = description;
  reminder.date = date;
  reminder.color = color;
  await reminder.save();

  return {
    id: Number(reminder.id),
    title: reminder.title,
    description: reminder.description,
    date: formatShortDate(reminder.date),
    color: reminder.color,
  };
};

const deleteReminder = async (reminderId, accountId) => {
  const parsedAccountId = Number(accountId);
  const parsedReminderId = Number(reminderId);
  if (!Number.isInteger(parsedAccountId) || parsedAccountId <= 0) {
    return false;
  }

  const deleted = await Reminder.destroy({
    where: { id: parsedReminderId, accountId: parsedAccountId },
  });

  return deleted > 0;
};

const getPedidoDetail = async (accountId, pedidoId) => {
  const parsedAccountId = Number(accountId);
  const parsedPedidoId = Number(pedidoId);
  if (!Number.isInteger(parsedAccountId) || parsedAccountId <= 0) {
    return null;
  }

  const rows = await sequelize.query(
    `
      SELECT
        p.npedido,
        p.nbadge,
        p.data_submissao,
        p.data_limite,
        p.descricao,
        e.estado,
        b.b_nome,
        b.b_descricao,
        b.imagem,
        b.pontos AS badge_pontos,
        t.tipo,
        a.area,
        n.nivel,
        b.validade
      FROM pedidos AS p
      INNER JOIN estado AS e ON e.nestado = p.estado
      LEFT JOIN badge AS b ON b.nbadge = p.nbadge
      LEFT JOIN tipo AS t ON t.ntipo = b.ntipo
      LEFT JOIN nivel_contem_b AS ncb ON ncb.nbadge = p.nbadge
      LEFT JOIN nivel AS n ON n.nnivel = ncb.nnivel
      LEFT JOIN area AS a ON a.narea = n.narea
      WHERE p.npedido = :pedidoId
        AND p.nutilizador = :utilizadorId
      LIMIT 1
    `,
    {
      replacements: { pedidoId: parsedPedidoId, utilizadorId: parsedAccountId },
      type: QueryTypes.SELECT,
    },
  );

  if (!rows || rows.length === 0) {
    return null;
  }

  const row = rows[0];
  const template = resolveBadgeTemplate(row.nivel, 0, row.tipo);
  const mappedStatus = mapPedidoEstadoToMyRequestStatus(row.estado);

  return {
    id: Number(row.npedido),
    name: row.b_nome || 'Badge',
    description: row.b_descricao || '',
    points: Number(row.badge_pontos) || template.points,
    badgeImage: row.imagem || template.badgeImage,
    status: mappedStatus,
    date: formatShortDate(row.data_submissao),
    expiryDate: formatShortDate(row.validade),
    level: normalizeLevelTitle(row.nivel),
    area: row.area || 'Badge',
  };
};

const saveEvidences = async (accountId, pedidoId, nreq, fileData) => {
  const parsedAccountId = Number(accountId);
  const parsedPedidoId = Number(pedidoId);
  const parsedNreq = Number(nreq);

  if (!Number.isInteger(parsedAccountId) || parsedAccountId <= 0) {
    throw new Error('Invalid account id.');
  }

  if (!Number.isInteger(parsedPedidoId) || parsedPedidoId <= 0) {
    throw new Error('Invalid pedido id.');
  }

  if (!Number.isInteger(parsedNreq) || parsedNreq <= 0) {
    throw new Error('Invalid requirement id.');
  }

  const pedido = await Pedido.findOne({
    where: { npedido: parsedPedidoId, nutilizador: parsedAccountId },
    attributes: ['npedido'],
  });

  if (!pedido) {
    throw new Error('Pedido not found or not owned by this account.');
  }

  const evidence = await Evidencia.create({
    npedido: parsedPedidoId,
    nreq: parsedNreq,
    nevidencia: fileData.filename,
    formato: fileData.formato,
  });

  return {
    id: Number(evidence.nevidencias),
    npedido: parsedPedidoId,
    nreq: parsedNreq,
    filename: fileData.filename,
    formato: fileData.formato,
  };
};

const getBadgeRequirements = async (badgeId) => {
  const parsedBadgeId = Number(badgeId);
  if (!Number.isInteger(parsedBadgeId) || parsedBadgeId <= 0) {
    return [];
  }

  const rows = await Requisito.findAll({
    where: { nbadge: parsedBadgeId },
    attributes: ['nreq', 'requisito', 'r_descricao', 'imagem'],
    order: [['nreq', 'ASC']],
    raw: true,
  });

  return (rows || []).map((row) => ({
    id: `req-${Number(row.nreq)}`,
    title: row.requisito || 'Requisito',
    description: row.r_descricao || '',
    image: row.imagem || null,
    files: 0,
    attachments: [],
  }));
};

const getCatalogBadges = async (includeExpired = false, accountId = null) => {
  const whereClause = includeExpired
    ? ''
    : "WHERE (b.validade IS NULL OR b.validade > CURRENT_DATE)";

  const rows = await sequelize.query(
    `
      SELECT
        b.nbadge,
        b.b_nome,
        b.b_descricao,
        b.pontos,
        b.imagem,
        t.tipo,
        n.nivel,
        a.area,
        a.narea,
        b.validade
      FROM badge AS b
      LEFT JOIN tipo AS t ON t.ntipo = b.ntipo
      LEFT JOIN nivel_contem_b AS ncb ON ncb.nbadge = b.nbadge
      LEFT JOIN nivel AS n ON n.nnivel = ncb.nnivel
      LEFT JOIN area AS a ON a.narea = n.narea
      ${whereClause}
      ORDER BY b.nbadge ASC
    `,
    { type: QueryTypes.SELECT },
  );

  const badgeIds = rows.map((r) => Number(r.nbadge)).filter(Boolean);
  const imageMap = badgeIds.length > 0 ? await loadBadgeImagesBatch(badgeIds) : {};

  let userObtainedBadgeIds = new Set();
  let userRequestedBadgeIds = new Set();

  if (accountId) {
    const utilizadorId = await getUtilizadorIdByAccountId(accountId);
    if (utilizadorId) {
      const [obtained, requested] = await Promise.all([
        CObtemBadge.findAll({
          where: { nutilizador: utilizadorId },
          attributes: ['nbadge'],
          raw: true,
        }),
        Pedido.findAll({
          where: { nutilizador: utilizadorId },
          attributes: ['nbadge'],
          raw: true,
        }),
      ]);

      userObtainedBadgeIds = new Set(obtained.map((r) => Number(r.nbadge)));
      userRequestedBadgeIds = new Set(requested.map((r) => Number(r.nbadge)));
    }
  }

  const badgeIdsForRequirements = rows.map((r) => Number(r.nbadge)).filter(Boolean);
  const requirementsByBadge = await loadRequirementsByBadgeIds(badgeIdsForRequirements);

  return (rows || []).map((row, index) => {
    const isSpecial = isSpecialTypeName(row.tipo);
    const template = resolveBadgeTemplate(row.nivel, index, row.tipo);
    const badgeId = Number(row.nbadge);

    let status = 'visualizar';
    if (userObtainedBadgeIds.has(badgeId)) {
      status = 'obtido';
    } else if (userRequestedBadgeIds.has(badgeId)) {
      status = 'candidatura_em_progresso';
    }

    return {
      id: `catalog-${badgeId}`,
      badgeDbId: badgeId,
      name: row.b_nome || row.area || 'Badge',
      description: row.b_descricao || '',
      points: Number(row.pontos) || template.points,
      badgeImage: imageMap[badgeId] || resolveBadgeImage(row.imagem, template.badgeImage, isSpecial),
      levelKey: isSpecial ? 'special' : template.levelKey,
      isSpecial,
      status,
      requirements: clone(requirementsByBadge.get(badgeId) || []),
      validade: row.validade || null,
    };
  });
};

const requestBadgeAcquisition = async (accountId, badgeId) => {
  const parsedAccountId = Number(accountId);
  const parsedBadgeId = Number(badgeId);

  if (!Number.isInteger(parsedAccountId) || parsedAccountId <= 0) {
    throw new Error('Invalid account id.');
  }

  if (!Number.isInteger(parsedBadgeId) || parsedBadgeId <= 0) {
    throw new Error('Invalid badge id.');
  }

  const utilizadorId = await getUtilizadorIdByAccountId(parsedAccountId);
  if (!utilizadorId) {
    throw new Error('User not found.');
  }

  const [hasObtained] = await sequelize.query(
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

  if (hasObtained) {
    const error = new Error('Badge already obtained.');
    error.statusCode = 409;
    throw error;
  }

  const pendingEstadoId = await ensureEstadoId('pendente-tm');

  const [createdPedido] = await sequelize.query(
    `
      INSERT INTO pedidos (nutilizador, nbadge, estado, data_submissao, data_limite)
      VALUES (:utilizadorId, :badgeId, :estadoId, CURRENT_DATE, CURRENT_DATE + INTERVAL '3 months')
      RETURNING npedido
    `,
    {
      replacements: {
        utilizadorId,
        badgeId: parsedBadgeId,
        estadoId: pendingEstadoId,
      },
      type: QueryTypes.SELECT,
    },
  );

  return {
    requestId: Number(createdPedido.npedido),
    badgeId: parsedBadgeId,
    status: 'pendente',
  };
};

const getPreferenceAreas = async (accountId) => {
  const parsedAccountId = Number(accountId);
  if (!Number.isInteger(parsedAccountId) || parsedAccountId <= 0) {
    return [];
  }

  const rows = await sequelize.query(
    `
      SELECT a.narea, a.area, a.a_desc
      FROM area AS a
      WHERE a.is_active = TRUE
      ORDER BY a.area ASC
    `,
    { type: QueryTypes.SELECT },
  );

  const preferences = await Preferencia.findAll({
    where: { nutilizador: parsedAccountId },
    attributes: ['narea'],
    raw: true,
  });

  const preferenceAreaIds = new Set(preferences.map((p) => Number(p.narea)));

  return (rows || []).map((row) => ({
    id: Number(row.narea),
    name: row.area,
    description: row.a_desc || '',
    selected: preferenceAreaIds.has(Number(row.narea)),
  }));
};

const getPreferences = async (accountId) => {
  const parsedAccountId = Number(accountId);
  if (!Number.isInteger(parsedAccountId) || parsedAccountId <= 0) {
    return [];
  }

  const preferences = await Preferencia.findAll({
    where: { nutilizador: parsedAccountId },
    attributes: ['narea'],
    raw: true,
  });

  return preferences.map((p) => Number(p.narea)).filter((id) => Number.isInteger(id) && id > 0);
};

const savePreferences = async (accountId, areaIds) => {
  const parsedAccountId = Number(accountId);
  if (!Number.isInteger(parsedAccountId) || parsedAccountId <= 0) {
    throw new Error('Invalid account id.');
  }

  await Preferencia.destroy({
    where: { nutilizador: parsedAccountId },
  });

  const normalizedAreaIds = [...new Set(
    (Array.isArray(areaIds) ? areaIds : [])
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0),
  )];

  for (const areaId of normalizedAreaIds) {
    await Preferencia.create({
      nutilizador: parsedAccountId,
      narea: areaId,
    });
  }

  return { saved: true, count: normalizedAreaIds.length };
};

const getUserVitrine = async (accountId) => {
  const parsedAccountId = Number(accountId);
  if (!Number.isInteger(parsedAccountId) || parsedAccountId <= 0) {
    return [];
  }

  const vitrines = await Vitrine.findAll({
    where: { nutilizador: parsedAccountId },
    order: [['ordem', 'ASC']],
    raw: true,
  });

  if (vitrines.length === 0) {
    return [];
  }

  const badgeIds = vitrines.map((v) => Number(v.nbadge)).filter(Boolean);
  const imageMap = badgeIds.length > 0 ? await loadBadgeImagesBatch(badgeIds) : {};

  const badgeDetails = await Promise.all(
    vitrines.map(async (v) => {
      const [row] = await sequelize.query(
        `
          SELECT
            b.nbadge,
            b.b_nome,
            b.b_descricao,
            b.pontos,
            b.imagem,
            t.tipo,
            n.nivel,
            a.area
          FROM badge AS b
          LEFT JOIN tipo AS t ON t.ntipo = b.ntipo
          LEFT JOIN nivel_contem_b AS ncb ON ncb.nbadge = b.nbadge
          LEFT JOIN nivel AS n ON n.nnivel = ncb.nnivel
          LEFT JOIN area AS a ON a.narea = n.narea
          WHERE b.nbadge = :badgeId
          LIMIT 1
        `,
        {
          replacements: { badgeId: Number(v.nbadge) },
          type: QueryTypes.SELECT,
        },
      );

      if (!row) return null;

      const isSpecial = isSpecialTypeName(row.tipo);
      const template = resolveBadgeTemplate(row.nivel, 0, row.tipo);

      return {
        id: `vitrine-${Number(row.nbadge)}`,
        badgeDbId: Number(row.nbadge),
        name: row.b_nome || row.area || 'Badge',
        points: Number(row.pontos) || template.points,
        badgeImage: imageMap[Number(row.nbadge)] || resolveBadgeImage(row.imagem, template.badgeImage, isSpecial),
        levelKey: isSpecial ? 'special' : template.levelKey,
        isSpecial,
        ordem: Number(v.ordem) || 0,
      };
    }),
  );

  return badgeDetails.filter(Boolean).sort((a, b) => a.ordem - b.ordem);
};

const saveUserVitrine = async (accountId, badges) => {
  const parsedAccountId = Number(accountId);
  if (!Number.isInteger(parsedAccountId) || parsedAccountId <= 0) {
    throw new Error('Invalid account id.');
  }

  await Vitrine.destroy({
    where: { nutilizador: parsedAccountId },
  });

  const normalizedBadges = Array.isArray(badges) ? badges : [];

  for (let index = 0; index < normalizedBadges.length; index += 1) {
    const badgeId = Number(normalizedBadges[index]?.badgeDbId || normalizedBadges[index]?.id);
    if (!Number.isInteger(badgeId) || badgeId <= 0) continue;

    await Vitrine.create({
      nutilizador: parsedAccountId,
      nbadge: badgeId,
      ordem: index,
    });
  }

  return { saved: true, count: normalizedBadges.length };
};

export const consultorModel = {
  syncSpecialBadgesForConsultor,
  syncSpecialBadgesForAllConsultors,
  resolveBadgeTemplate,
  resolveBadgeImage,
  isSpecialTypeName,
  sendAllExpirationNotifications,
  getProfileData,
  updateProfileData,
  getRankingConsultores,
  getReminders,
  createReminder,
  updateReminder,
  deleteReminder,
  getPedidoDetail,
  saveEvidences,
  getBadgeRequirements,
  getCatalogBadges,
  requestBadgeAcquisition,
  getPreferenceAreas,
  getPreferences,
  savePreferences,
  getUserVitrine,
  saveUserVitrine,
  async getBadgeSuggestions(accountId, limit) {
    const data = await buildBadgeSuggestions(accountId, limit);
    const badgeIds = data.map((s) => s.badgeDbId).filter((id) => id > 0);
    if (badgeIds.length > 0) {
      const imageMap = await loadBadgeImagesBatch(badgeIds).catch(() => ({}));
      for (const item of data) {
        if (imageMap[item.badgeDbId]) {
          item.badgeImage = imageMap[item.badgeDbId];
        }
      }
    }
    return clone(data);
  },
  getLearningPaths: buildLearningPaths,
  getMyBadges: buildMyBadges,
  getMyRequests: buildMyRequests,
};
