import { QueryTypes } from 'sequelize';
import fs from 'node:fs';
import path from 'node:path';
import { sequelize } from '../config/database.js';
import { syncSpecialBadgesForConsultor } from './consultorModel.js';
import { communicationModel } from './communicationModel.js';
import { sendEmail } from '../services/emailService.js';
import { emailTemplates } from '../services/emailTemplates.js';
import { adminBadgeModel } from './adminBadgeModel.js';

const clone = (value) => JSON.parse(JSON.stringify(value));
const uploadsDir = path.resolve(globalThis.process?.cwd?.() || '.', 'uploads');

const roleSet = new Set(['talent-manager', 'service-line-leader', 'admin-gestor']);
// Estados canónicos e aliases legados suportados no fluxo de gestão.
const workflowState = Object.freeze({
  rejeitado: 'rejeitado',
  pendenteTm: 'pendente-tm',
  pendenteSll: 'pendente-sll',
  aprovado: 'aprovado',
  legacyPendenteTm: 'em_validacao',
  legacyPendenteSll: 'em_validacao_sll',
  legacyRejeitado: 'evidencias_insuficientes',
});

const workflowStateGroups = Object.freeze({
  rejected: new Set([workflowState.rejeitado, workflowState.legacyRejeitado]),
  pendingTm: new Set([workflowState.pendenteTm, workflowState.legacyPendenteTm]),
  pendingSll: new Set([workflowState.pendenteSll, workflowState.legacyPendenteSll]),
  approved: new Set([workflowState.aprovado]),
});

const REQUEST_EXPIRATION_MONTHS = 3;
const AUTO_REJECTION_NOTE = 'Candidatura rejeitada automaticamente por expiracao de prazo.';

const autoRejectExpiredRequests = async () => {
  const rejectedEstadoId = await ensureEstadoId(workflowState.rejeitado);
  const approvedEstadoId = await ensureEstadoId(workflowState.aprovado);

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
        rejectedId: rejectedEstadoId,
        approvedId: approvedEstadoId,
        defaultDescription: AUTO_REJECTION_NOTE,
      },
      type: QueryTypes.UPDATE,
    },
  );
};

const badgeLevelTemplates = [
  {
    points: 100,
    badgeImage: '/badges/J%C3%BAnior.png',
  },
  {
    points: 150,
    badgeImage: '/badges/Interm%C3%A9dio.png',
  },
  {
    points: 200,
    badgeImage: '/badges/S%C3%A9nior.png',
  },
  {
    points: 250,
    badgeImage: '/badges/Especialista.png',
  },
  {
    points: 300,
    badgeImage: '/badges/L%C3%ADder%20de%20Conhecimento.png',
  },
];

const parseRole = (role) => {
  const normalizedRole = String(role || '').trim().toLowerCase();
  return roleSet.has(normalizedRole) ? normalizedRole : null;
};

const normalizeLevelTitle = (value) => {
  const rawTitle = String(value || '').trim();
  const withoutPathPrefix = rawTitle.includes(' - ')
    ? rawTitle.split(' - ').slice(1).join(' - ').trim()
    : rawTitle;

  return withoutPathPrefix.replace(/^nivel\s+/i, '').trim();
};

const resolveLevelTemplate = (levelName) => {
  const normalized = String(levelName || '').trim().toLowerCase();

  if (normalized.includes('junior')) {
    return badgeLevelTemplates[0];
  }

  if (normalized.includes('intermedio') || normalized.includes('interm')) {
    return badgeLevelTemplates[1];
  }

  if (normalized.includes('senior')) {
    return badgeLevelTemplates[2];
  }

  if (normalized.includes('especialista')) {
    return badgeLevelTemplates[3];
  }

  if (normalized.includes('lider')) {
    return badgeLevelTemplates[4];
  }

  return badgeLevelTemplates[1];
};

const getRequirementPrefix = (levelName) => {
  const normalized = String(levelName || '').trim().toLowerCase();

  if (normalized.includes('junior')) return 'A';
  if (normalized.includes('intermedio') || normalized.includes('interm')) return 'B';
  if (normalized.includes('senior')) return 'C';
  if (normalized.includes('especialista')) return 'D';
  return 'E';
};

const formatDate = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return 'N/A';
  }

  return date.toLocaleDateString('pt-PT');
};

const formatLongDate = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return 'Data indisponível';
  }

  return date.toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
};

const buildAvatar = () => null;

const getServiceLineIdForBadge = async (badgeId) => {
  const parsedBadgeId = Number(badgeId);
  if (!Number.isInteger(parsedBadgeId) || parsedBadgeId <= 0) {
    return null;
  }

  const [row] = await sequelize.query(
    `
      SELECT
        COALESCE(bsl.nsline, a.nsline) AS service_line_id
      FROM badge AS b
      LEFT JOIN b_pertence_sl AS bsl
        ON bsl.nbadge = b.nbadge
      LEFT JOIN b_pertence_a AS bpa
        ON bpa.nbadge = b.nbadge
      LEFT JOIN area AS a
        ON a.narea = bpa.narea
      WHERE b.nbadge = :badgeId
      LIMIT 1
    `,
    {
      replacements: { badgeId: parsedBadgeId },
      type: QueryTypes.SELECT,
    },
  );

  const serviceLineId = Number(row?.service_line_id);
  return Number.isInteger(serviceLineId) && serviceLineId > 0 ? serviceLineId : null;
};

const deleteEvidenceFiles = async (fileNames) => {
  const uniqueNames = [...new Set((Array.isArray(fileNames) ? fileNames : [])
    .map((name) => path.basename(String(name || '').trim()))
    .filter(Boolean))];

  if (uniqueNames.length === 0) {
    return;
  }

  await Promise.all(uniqueNames.map(async (safeName) => {
    const resolvedPath = path.resolve(uploadsDir, safeName);
    const isInsideUploadsDir = resolvedPath === uploadsDir
      || resolvedPath.startsWith(`${uploadsDir}${path.sep}`);

    if (!isInsideUploadsDir) {
      return;
    }

    try {
      await fs.promises.unlink(resolvedPath);
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        // Ignore missing files and keep best-effort cleanup.
      }
    }
  }));
};

// Helpers de estado e permissões para o fluxo de aprovação de pedidos.
const roleLabels = Object.freeze({
  'talent-manager': 'Talent Manager',
  'service-line-leader': 'Service Line Leader',
  'admin-gestor': 'Administrador/Gestor',
});

const normalizeEstadoName = (estadoNome) => String(estadoNome || '').trim().toLowerCase();

const isPendingTmState = (estadoNome) => workflowStateGroups.pendingTm.has(normalizeEstadoName(estadoNome));
const isPendingSllState = (estadoNome) => workflowStateGroups.pendingSll.has(normalizeEstadoName(estadoNome));
const isRejectedState = (estadoNome) => workflowStateGroups.rejected.has(normalizeEstadoName(estadoNome));
const isApprovedState = (estadoNome) => workflowStateGroups.approved.has(normalizeEstadoName(estadoNome));

const isManagedWorkflowState = (estadoNome) => (
  isPendingTmState(estadoNome)
  || isPendingSllState(estadoNome)
  || isRejectedState(estadoNome)
  || isApprovedState(estadoNome)
);

// Verifica se pedido está aprovado (estado 4 ou tem flag obtido)
const isApprovedRequest = (estadoNome, obtido) => Boolean(obtido) || isApprovedState(estadoNome);

// Retorna clause SQL para filtrar pedidos visíveis por role
const sqlQuoteStateValues = (values) => [...new Set(values)]
  .map((value) => `'${String(value).replace(/'/g, "''").toLowerCase()}'`)
  .join(', ');

const buildStateInClause = (values) => `LOWER(e.estado) IN (${sqlQuoteStateValues(values)})`;

const buildRoleStatusClause = (role) => {
  if (role === 'service-line-leader') {
    return buildStateInClause([
      ...workflowStateGroups.pendingSll,
      ...workflowStateGroups.rejected,
      ...workflowStateGroups.approved,
    ]);
  }

  if (role === 'talent-manager') {
    return buildStateInClause([
      ...workflowStateGroups.pendingTm,
      ...workflowStateGroups.pendingSll,
      ...workflowStateGroups.rejected,
      ...workflowStateGroups.approved,
    ]);
  }

  return buildStateInClause([
    ...workflowStateGroups.pendingTm,
    ...workflowStateGroups.pendingSll,
    ...workflowStateGroups.rejected,
    ...workflowStateGroups.approved,
  ]);
};

const mapRowStatus = (estadoNome, obtido, role) => {
  if (isApprovedRequest(estadoNome, obtido)) {
    return 'aprovado';
  }

  if (isRejectedState(estadoNome)) {
    return 'rejeitado';
  }

  if (isPendingTmState(estadoNome)) {
    return (role === 'talent-manager' || role === 'admin-gestor') ? 'validacao' : 'pendente';
  }

  if (isPendingSllState(estadoNome)) {
    return (role === 'service-line-leader' || role === 'admin-gestor') ? 'validacao' : 'pendente';
  }

  return 'pendente';
};

const mapTableStatus = (status) => {
  if (status === 'aprovado') return 'aprovado';
  if (status === 'rejeitado') return 'rejeitado';
  return 'pendente';
};

const buildStatusNote = (status, estadoNome, description) => {
  const customDescription = String(description || '').trim();
  if (customDescription) {
    return customDescription;
  }

  if (isPendingSllState(estadoNome)) {
    return 'Candidatura validada pelo Talent Manager e enviada para SLL.';
  }

  if (isPendingTmState(estadoNome)) {
    return 'Candidatura submetida e em validacao pelo Talent Manager.';
  }

  if (isRejectedState(estadoNome)) {
    return 'Evidencias insuficientes para a conclusao da submissao.';
  }

  if (status === 'aprovado') {
    return 'Candidatura aprovada com base nas evidencias submetidas.';
  }

  return 'Candidatura em progresso.';
};

const parseRoleTokens = (permissions) => String(permissions || '')
  .split(/[;,]/)
  .map((token) => token.trim().toLowerCase())
  .filter(Boolean);

const getRoleKeyFromPermissions = (permissions) => {
  const tokens = parseRoleTokens(permissions);

  if (tokens.includes('admin-gestor')) return 'admin-gestor';
  if (tokens.includes('service-line-leader')) return 'service-line-leader';
  if (tokens.includes('talent-manager')) return 'talent-manager';
  return null;
};

const getRoleLabel = (role) => roleLabels[role] || 'Gestor';

const mapRoleOrder = (role) => {
  if (role === 'admin-gestor') return 1;
  if (role === 'service-line-leader') return 2;
  if (role === 'talent-manager') return 3;
  return 4;
};

const shouldRoleReviewRequest = (role, estadoNome) => {
  if (role === 'admin-gestor') {
    return isManagedWorkflowState(estadoNome);
  }

  if (role === 'talent-manager') {
    return isPendingTmState(estadoNome);
  }

  if (role === 'service-line-leader') {
    return isPendingSllState(estadoNome);
  }

  return false;
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

const buildRequirements = async (pedidoId, badgeId, levelName) => {
  const [requirementsRows, evidenceRows] = await Promise.all([
    sequelize.query(
      `
        SELECT nreq, requisito, r_descricao, imagem
        FROM requisitos
        WHERE nbadge = :badgeId
        ORDER BY nreq ASC
      `,
      {
        replacements: { badgeId: Number(badgeId) },
        type: QueryTypes.SELECT,
      },
    ),
    sequelize.query(
      `
        SELECT nevidencias, nreq, nevidencia, formato
        FROM evidencias
        WHERE npedido = :pedidoId
        ORDER BY nreq ASC, nevidencias ASC
      `,
      {
        replacements: { pedidoId: Number(pedidoId) },
        type: QueryTypes.SELECT,
      },
    ),
  ]);

  const evidenceByReq = new Map();
  const unscopedAttachments = [];

  for (const row of evidenceRows) {
    const requirementId = Number(row.nreq);
    const extension = String(row.formato || '').trim().toLowerCase();
    const labelBase = String(row.nevidencia || 'evidencia').trim();
    const label = extension && !labelBase.toLowerCase().endsWith(`.${extension}`)
      ? `${labelBase}.${extension}`
      : labelBase;
    const attachment = {
      id: `evidence-${Number(row.nevidencias) || label}`,
      evidenceId: Number(row.nevidencias) || null,
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

  const requirements = [];
  if (requirementsRows.length > 0) {
    for (let index = 0; index < requirementsRows.length; index += 1) {
      const row = requirementsRows[index];
      const requirementId = Number(row.nreq);
      const attachments = evidenceByReq.get(requirementId) || [];
      const files = attachments.length;

      requirements.push({
        id: `req-${requirementId}`,
        title: row.requisito,
        description: row.r_descricao,
        image: row.imagem || null,
        files,
        attachments,
      });
    }

    if (requirements.length > 0 && unscopedAttachments.length > 0) {
      requirements[0].files += unscopedAttachments.length;
      requirements[0].attachments = [...requirements[0].attachments, ...unscopedAttachments];
    }

    return requirements;
  }

  const prefix = getRequirementPrefix(levelName);
  const fallbackTitles = [
    'Implementar conectividade híbrida',
    'Monitorizar infraestrutura híbrida',
    'Implementar disaster recovery',
  ];

  for (let index = 0; index < fallbackTitles.length; index += 1) {
    requirements.push({
      id: `fallback-${index + 1}`,
      title: `${prefix}${index + 1} - ${fallbackTitles[index]}`,
      description: 'Texto de suporte do requisito associado à candidatura.',
      files: 0,
      attachments: [],
    });
  }

  if (requirements.length > 0 && unscopedAttachments.length > 0) {
    requirements[0].files = unscopedAttachments.length;
    requirements[0].attachments = unscopedAttachments;
  }

  return requirements;
};

const buildRoleJoin = (role) => {
  if (role === 'service-line-leader') {
    return `
      INNER JOIN b_pertence_sl AS bsl
        ON bsl.nbadge = p.nbadge
      INNER JOIN sll_leader_sl AS sll
       ON sll.nsline = bsl.nsline
       AND sll.nutilizador = :actorUtilizadorId
    `;
  }

  return '';
};

const fetchRequestRows = async ({ role, actorUtilizadorId, requestId = null }) => {
  const roleJoin = buildRoleJoin(role);
  const roleStatusClause = buildRoleStatusClause(role);
  const whereClause = requestId
    ? `WHERE p.npedido = :requestId AND ${roleStatusClause}`
    : `WHERE ${roleStatusClause}`;
  const replacements = requestId
    ? {
      actorUtilizadorId,
      requestId: Number(requestId),
    }
    : {
      actorUtilizadorId,
    };

  const query = requestId
    ? `
      SELECT
        p.npedido,
        p.nutilizador AS consultor_id,
        p.nbadge,
        p.estado AS estado_id,
        p.data_submissao,
        p.descricao,
        e.estado AS estado_nome,
        u.nome AS consultor_nome,
        b.b_nome AS badge_nome,
        b.validade AS badge_validade,
        COALESCE(NULLIF(b.pontos, 0), 0) AS badge_pontos,
        n.nivel AS nivel_nome,
        a.area AS area_nome,
        sl.sline AS service_line_nome,
        lp.lpath AS learning_path_nome,
        CASE WHEN cb.nbadge IS NULL THEN FALSE ELSE TRUE END AS obtido
      FROM pedidos AS p
      ${roleJoin}
      INNER JOIN estado AS e
        ON e.nestado = p.estado
      INNER JOIN utilizador AS u
        ON u.nutilizador = p.nutilizador
      LEFT JOIN badge AS b
        ON b.nbadge = p.nbadge
      LEFT JOIN nivel_contem_b AS ncb
        ON ncb.nbadge = p.nbadge
      LEFT JOIN nivel AS n
        ON n.nnivel = ncb.nnivel
      LEFT JOIN area AS a
        ON a.narea = n.narea
      LEFT JOIN service_line AS sl
        ON sl.nsline = a.nsline
      LEFT JOIN learning_path AS lp
        ON lp.nlpath = sl.nlpath
      LEFT JOIN c_obtem_b AS cb
        ON cb.nutilizador = p.nutilizador
       AND cb.nbadge = p.nbadge
      ${whereClause}
        AND (b.validade IS NULL OR b.validade > CURRENT_DATE)
      LIMIT 1
    `
    : `
      WITH latest AS (
        SELECT DISTINCT ON (p.nutilizador, p.nbadge)
          p.npedido
        FROM pedidos AS p
        ORDER BY p.nutilizador, p.nbadge, p.data_submissao DESC, p.npedido DESC
      )
      SELECT
        p.npedido,
        p.nutilizador AS consultor_id,
        p.nbadge,
        p.estado AS estado_id,
        p.data_submissao,
        p.descricao,
        e.estado AS estado_nome,
        u.nome AS consultor_nome,
        b.b_nome AS badge_nome,
        b.validade AS badge_validade,
        COALESCE(NULLIF(b.pontos, 0), 0) AS badge_pontos,
        n.nivel AS nivel_nome,
        a.area AS area_nome,
        sl.sline AS service_line_nome,
        lp.lpath AS learning_path_nome,
        CASE WHEN cb.nbadge IS NULL THEN FALSE ELSE TRUE END AS obtido
      FROM latest AS l
      INNER JOIN pedidos AS p
        ON p.npedido = l.npedido
      ${roleJoin}
      INNER JOIN estado AS e
        ON e.nestado = p.estado
      INNER JOIN utilizador AS u
        ON u.nutilizador = p.nutilizador
      LEFT JOIN badge AS b
        ON b.nbadge = p.nbadge
      LEFT JOIN nivel_contem_b AS ncb
        ON ncb.nbadge = p.nbadge
      LEFT JOIN nivel AS n
        ON n.nnivel = ncb.nnivel
      LEFT JOIN area AS a
        ON a.narea = n.narea
      LEFT JOIN service_line AS sl
        ON sl.nsline = a.nsline
      LEFT JOIN learning_path AS lp
        ON lp.nlpath = sl.nlpath
      LEFT JOIN c_obtem_b AS cb
        ON cb.nutilizador = p.nutilizador
       AND cb.nbadge = p.nbadge
      ${whereClause}
        AND (b.validade IS NULL OR b.validade > CURRENT_DATE)
      ORDER BY p.data_submissao DESC, p.npedido DESC
    `;

  return sequelize.query(query, {
    replacements,
    type: QueryTypes.SELECT,
  });
};

const mapRequestListItem = (row, role) => {
  const levelTitle = normalizeLevelTitle(row.nivel_nome) || 'Intermédio';
  const levelTemplate = resolveLevelTemplate(levelTitle);
  const status = mapRowStatus(row.estado_nome, row.obtido, role);

  return {
    id: Number(row.npedido),
    consultant: row.consultor_nome,
    badge: row.area_nome || row.badge_nome || 'Badge',
    level: levelTitle,
    levelLabel: `Nível ${levelTitle}`,
    area: row.learning_path_nome || 'Jornada Técnica',
    path: row.service_line_nome || 'Service Line',
    date: formatDate(row.data_submissao),
    status,
    tableStatus: mapTableStatus(status),
    points: Number(row.badge_pontos) > 0 ? Number(row.badge_pontos) : levelTemplate.points,
    badgeImage: levelTemplate.badgeImage,
  };
};

const fetchRequestMotives = async (requestId) => {
  const rows = await sequelize.query(
    `
      SELECT
        m.nutilizador,
        m.motivo_desc,
        u.nome AS autor_nome,
        u.permissoes AS autor_permissoes
      FROM motivo AS m
      INNER JOIN utilizador AS u
        ON u.nutilizador = m.nutilizador
      WHERE m.npedido = :requestId
    `,
    {
      replacements: { requestId: Number(requestId) },
      type: QueryTypes.SELECT,
    },
  );

  return rows
    .map((row) => {
      const roleKey = getRoleKeyFromPermissions(row.autor_permissoes);
      const reason = String(row.motivo_desc || '').trim();

      return {
        authorId: Number(row.nutilizador),
        authorName: row.autor_nome || 'Utilizador',
        authorRole: getRoleLabel(roleKey),
        roleKey,
        reason,
      };
    })
    .filter((row) => row.reason)
    .sort((left, right) => {
      const orderDiff = mapRoleOrder(left.roleKey) - mapRoleOrder(right.roleKey);
      if (orderDiff !== 0) {
        return orderDiff;
      }

      return String(left.authorName || '').localeCompare(String(right.authorName || ''), 'pt');
    });
};

const pickReviewerFromMotives = (motives, estadoNome, description) => {
  const normalizedDescription = String(description || '').trim().toLowerCase();
  if (normalizedDescription) {
    const matched = motives.find(
      (item) => String(item.reason || '').trim().toLowerCase() === normalizedDescription,
    );
    if (matched) {
      return matched;
    }
  }

  if (isPendingSllState(estadoNome)) {
    return motives.find((item) => item.roleKey === 'talent-manager') || null;
  }

  if (isPendingTmState(estadoNome)) {
    return motives.find((item) => item.roleKey === 'service-line-leader')
      || motives.find((item) => item.roleKey === 'talent-manager')
      || null;
  }

  if (isApprovedState(estadoNome) || isRejectedState(estadoNome)) {
    return motives.find((item) => item.roleKey === 'admin-gestor')
      || motives.find((item) => item.roleKey === 'service-line-leader')
      || motives.find((item) => item.roleKey === 'talent-manager')
      || null;
  }

  return motives[0] || null;
};

const mapRequestDetails = async (row, role) => {
  const baseItem = mapRequestListItem(row, role);
  const [requirements, motives] = await Promise.all([
    buildRequirements(row.npedido, row.nbadge, baseItem.level),
    fetchRequestMotives(row.npedido),
  ]);
  const status = baseItem.status;
  const estadoNome = normalizeEstadoName(row.estado_nome);
  const fallbackReviewerRole = role === 'service-line-leader'
    ? getRoleLabel('talent-manager')
    : role === 'admin-gestor'
      ? getRoleLabel('admin-gestor')
      : getRoleLabel('talent-manager');
  const reviewerEntry = pickReviewerFromMotives(motives, estadoNome, row.descricao);
  const reviewerName = reviewerEntry?.authorName || fallbackReviewerRole;
  const reviewerRole = reviewerEntry?.authorRole || fallbackReviewerRole;
  const reviewerSeed = reviewerEntry?.authorId || reviewerEntry?.authorName || role;
  const canReview = shouldRoleReviewRequest(role, estadoNome);

  return {
    ...baseItem,
    badgeDbId: Number(row.nbadge),
    expiresAt: formatDate(row.badge_validade),
    submittedBy: row.consultor_nome,
    submittedByAvatar: buildAvatar(`consultor-${row.consultor_id}`),
    submittedDate: formatLongDate(row.data_submissao),
    reviewer: reviewerName,
    reviewerRole,
    reviewerAvatar: buildAvatar(`reviewer-${reviewerSeed}`),
    reviewerDate: formatLongDate(row.data_submissao),
    notes: buildStatusNote(status, row.estado_nome, row.descricao),
    motives: motives.map((item) => ({
      authorName: item.authorName,
      authorRole: item.authorRole,
      reason: item.reason,
    })),
    canReview,
    finalReviewer: status === 'aprovado' ? reviewerName : null,
    finalReviewerAvatar: status === 'aprovado' ? buildAvatar(`final-${reviewerSeed}`) : null,
    finalReviewerDate: status === 'aprovado' ? formatLongDate(row.data_submissao) : null,
    evidence: requirements,
  };
};

const getRequestByIdForRole = async (role, actorUtilizadorId, requestId) => {
  const [row] = await fetchRequestRows({ role, actorUtilizadorId, requestId });
  return row || null;
};

const ensureRoleAccessToRequest = async (role, actorUtilizadorId, request) => {
  if (role !== 'service-line-leader') {
    return true;
  }

  const [hasAccess] = await sequelize.query(
    `
      SELECT 1
      FROM b_pertence_sl AS bsl
      INNER JOIN sll_leader_sl AS sll
        ON sll.nsline = bsl.nsline
      WHERE bsl.nbadge = :badgeId
        AND sll.nutilizador = :actorUtilizadorId
      LIMIT 1
    `,
    {
      replacements: {
        badgeId: Number(request.nbadge),
        actorUtilizadorId: Number(actorUtilizadorId),
      },
      type: QueryTypes.SELECT,
    },
  );

  return Boolean(hasAccess);
};

const insertManagerOwnership = async (role, actorUtilizadorId, requestId) => {
  if (role === 'talent-manager') {
    await sequelize.query(
      `
        INSERT INTO tm_gere_p (tm_nutilizador, npedido)
        VALUES (:actorUtilizadorId, :requestId)
        ON CONFLICT (tm_nutilizador, npedido) DO NOTHING
      `,
      {
        replacements: { actorUtilizadorId: Number(actorUtilizadorId), requestId: Number(requestId) },
        type: QueryTypes.INSERT,
      },
    );
    return;
  }

  if (role === 'service-line-leader') {
    await sequelize.query(
      `
        INSERT INTO sll_gere_p (ser_nutilizador, npedido)
        VALUES (:actorUtilizadorId, :requestId)
        ON CONFLICT (ser_nutilizador, npedido) DO NOTHING
      `,
      {
        replacements: { actorUtilizadorId: Number(actorUtilizadorId), requestId: Number(requestId) },
        type: QueryTypes.INSERT,
      },
    );
    return;
  }

  if (role === 'admin-gestor') {
    await sequelize.query(
      `
        INSERT INTO adm_gere_p (adm_nutilizador, npedido)
        VALUES (:actorUtilizadorId, :requestId)
        ON CONFLICT (adm_nutilizador, npedido) DO NOTHING
      `,
      {
        replacements: { actorUtilizadorId: Number(actorUtilizadorId), requestId: Number(requestId) },
        type: QueryTypes.INSERT,
      },
    );
  }
};

const upsertRequestMotivo = async ({ requestId, actorUtilizadorId, description, transaction }) => {
  await sequelize.query(
    `
      INSERT INTO motivo (npedido, nutilizador, motivo_desc)
      VALUES (:requestId, :actorUtilizadorId, :description)
      ON CONFLICT (nutilizador, npedido)
      DO UPDATE SET motivo_desc = EXCLUDED.motivo_desc
    `,
    {
      replacements: {
        requestId: Number(requestId),
        actorUtilizadorId: Number(actorUtilizadorId),
        description,
      },
      type: QueryTypes.INSERT,
      transaction,
    },
  );
};

const applyDecision = async ({ role, actorUtilizadorId, request, decision, comment }) => {
  await adminBadgeModel.checkAndExpireBadges();

  const decisionKey = String(decision || '').trim().toLowerCase().replace(/-/g, '_');
  const currentEstado = normalizeEstadoName(request.estado_nome);
  const allowedDecisionsByRole = {
    'talent-manager': new Set(['aprovar', 'rejeitar', 'devolver_consultor']),
    'service-line-leader': new Set(['aprovar', 'rejeitar', 'devolver_consultor']),
    'admin-gestor': new Set(['aprovar', 'rejeitar', 'devolver_consultor']),
  };
  const roleAllowedDecisions = allowedDecisionsByRole[role] || new Set();

  if (!roleAllowedDecisions.has(decisionKey)) {
    const error = new Error('Decision is not allowed for this role.');
    error.statusCode = 400;
    throw error;
  }

  if (role === 'talent-manager' && !isPendingTmState(currentEstado)) {
    const error = new Error('Request is not pending Talent Manager validation.');
    error.statusCode = 409;
    throw error;
  }

  if (role === 'service-line-leader' && !isPendingSllState(currentEstado)) {
    const error = new Error('Request is not pending Service Line Leader validation.');
    error.statusCode = 409;
    throw error;
  }

  if (role === 'admin-gestor' && !isManagedWorkflowState(currentEstado)) {
    const error = new Error('Request is not in a managed workflow state for admin review.');
    error.statusCode = 409;
    throw error;
  }

  let targetEstadoNome = null;
  let shouldObtainBadge = false;
  let shouldRemoveBadge = false;
  let shouldRemoveEvidence = false;
  let defaultDescription = '';
  const evidenceFilesToDelete = [];

  if (decisionKey === 'rejeitar') {
    targetEstadoNome = workflowState.rejeitado;
    shouldRemoveBadge = isApprovedRequest(currentEstado, request.obtido);
    shouldRemoveEvidence = true;
    defaultDescription = role === 'talent-manager'
      ? 'Candidatura rejeitada pelo Talent Manager.'
      : role === 'service-line-leader'
        ? 'Candidatura rejeitada pelo Service Line Leader.'
        : 'Candidatura rejeitada pelo Administrador/Gestor.';
  } else if (decisionKey === 'devolver_consultor') {
    targetEstadoNome = workflowState.rejeitado;
    shouldRemoveBadge = isApprovedRequest(currentEstado, request.obtido);
    defaultDescription = role === 'talent-manager'
      ? 'Candidatura devolvida ao consultor pelo Talent Manager.'
      : role === 'service-line-leader'
        ? 'Candidatura devolvida ao consultor pelo Service Line Leader.'
        : 'Candidatura devolvida ao consultor pelo Administrador/Gestor.';
  } else if (decisionKey === 'aprovar' && role === 'talent-manager') {
    targetEstadoNome = workflowState.pendenteSll;
    defaultDescription = 'Candidatura validada pelo Talent Manager e enviada para SLL.';
  } else if (decisionKey === 'aprovar' && (role === 'service-line-leader' || role === 'admin-gestor')) {
    targetEstadoNome = workflowState.aprovado;
    shouldObtainBadge = true;
    defaultDescription = role === 'service-line-leader'
      ? 'Candidatura aprovada pelo Service Line Leader.'
      : 'Candidatura aprovada pelo Administrador/Gestor.';
  }

  if (!targetEstadoNome) {
    const error = new Error('Unable to resolve next workflow state.');
    error.statusCode = 500;
    throw error;
  }

  const consultorId = Number(request.consultor_id ?? request.nutilizador);
  if (!Number.isInteger(consultorId) || consultorId <= 0) {
    const error = new Error('Unable to identify request consultant.');
    error.statusCode = 500;
    throw error;
  }

  const finalDescription = String(comment || '').trim() || defaultDescription;
  const targetEstadoId = await ensureEstadoId(targetEstadoNome);
  const transaction = await sequelize.transaction();

  try {
    await sequelize.query(
      `
        UPDATE pedidos
        SET estado = :estadoId,
            descricao = :descricao
        WHERE npedido = :requestId
      `,
      {
        replacements: {
          estadoId: targetEstadoId,
          descricao: finalDescription,
          requestId: Number(request.npedido),
        },
        type: QueryTypes.UPDATE,
        transaction,
      },
    );

    await upsertRequestMotivo({
      requestId: request.npedido,
      actorUtilizadorId,
      description: finalDescription,
      transaction,
    });

    if (shouldRemoveEvidence) {
      const evidenceRows = await sequelize.query(
        `
          SELECT nevidencia
          FROM evidencias
          WHERE npedido = :requestId
        `,
        {
          replacements: { requestId: Number(request.npedido) },
          type: QueryTypes.SELECT,
          transaction,
        },
      );

      evidenceFilesToDelete.push(
        ...evidenceRows.map((row) => row?.nevidencia).filter(Boolean),
      );

      await sequelize.query(
        `
          DELETE FROM evidencias
          WHERE npedido = :requestId
        `,
        {
          replacements: { requestId: Number(request.npedido) },
          type: QueryTypes.DELETE,
          transaction,
        },
      );
    }

    if (shouldRemoveBadge) {
      await sequelize.query(
        `
          DELETE FROM c_obtem_b
          WHERE nutilizador = :consultorId AND nbadge = :badgeId
        `,
        {
          replacements: {
            consultorId,
            badgeId: Number(request.nbadge),
          },
          type: QueryTypes.DELETE,
          transaction,
        },
      );
    } else if (shouldObtainBadge) {
      const [badgePointsRow] = await sequelize.query(
        `
          SELECT COALESCE(NULLIF(pontos, 0), 100) AS pontos
          FROM badge
          WHERE nbadge = :badgeId
          LIMIT 1
        `,
        {
          replacements: { badgeId: Number(request.nbadge) },
          type: QueryTypes.SELECT,
          transaction,
        },
      );

      const points = Number(badgePointsRow?.pontos) || 100;

      await sequelize.query(
        `
          INSERT INTO c_obtem_b (nutilizador, nbadge, npedido, pontos_obtidos, data_obtencao)
          VALUES (:consultorId, :badgeId, :requestId, :points, CURRENT_DATE)
          ON CONFLICT (nutilizador, nbadge)
          DO UPDATE SET
            npedido = EXCLUDED.npedido,
            pontos_obtidos = EXCLUDED.pontos_obtidos,
            data_obtencao = EXCLUDED.data_obtencao
        `,
        {
          replacements: {
            consultorId,
            badgeId: Number(request.nbadge),
            requestId: Number(request.npedido),
            points,
          },
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

  if (shouldObtainBadge) {
    try {
      const serviceLineId = await getServiceLineIdForBadge(request.nbadge);
      const badgeName = request.badge_nome || request.area_nome || 'Badge';
      const consultorName = request.consultor_nome || 'Consultor';

      await communicationModel.dispatchEventNotification({
        eventKey: 'Recebe badge',
        actorAccountId: actorUtilizadorId,
        title: 'Badge atribuida',
        message: `O consultor ${consultorName} recebeu a badge ${badgeName}.`,
        consultorIds: [consultorId],
        serviceLineId,
      });
    } catch (error) {
      console.error('Failed to notify badge delivery.', error);
    }
  }

  const shouldNotifyApproval = targetEstadoNome === workflowState.aprovado;
  const shouldNotifyRejection = targetEstadoNome === workflowState.rejeitado && decisionKey === 'rejeitar';
  if (shouldNotifyApproval || shouldNotifyRejection) {
    try {
      const serviceLineId = await getServiceLineIdForBadge(request.nbadge);
      const badgeName = request.badge_nome || request.area_nome || 'Badge';
      const consultorName = request.consultor_nome || 'Consultor';

      if (shouldNotifyApproval) {
        await communicationModel.dispatchEventNotification({
          eventKey: 'Pedido aprovado',
          actorAccountId: actorUtilizadorId,
          title: 'Pedido aprovado',
          message: `O pedido da badge ${badgeName} para ${consultorName} foi aprovado.`,
          consultorIds: [consultorId],
          serviceLineId,
        });
      }

      if (shouldNotifyRejection) {
        await communicationModel.dispatchEventNotification({
          eventKey: 'Pedido rejeitado',
          actorAccountId: actorUtilizadorId,
          title: 'Pedido rejeitado',
          message: `O pedido da badge ${badgeName} para ${consultorName} foi rejeitado.`,
          consultorIds: [consultorId],
          serviceLineId,
        });
      }
    } catch (error) {
      console.error('Failed to notify request decision.', error);
    }

    // Send email notifications for approval/rejection
    try {
      const [consultorInfo] = await sequelize.query(
        'SELECT nome, email FROM utilizador WHERE nutilizador = :consultorId LIMIT 1',
        {
          replacements: { consultorId: Number(consultorId) },
          type: QueryTypes.SELECT,
        }
      );
      const badgeName = request.badge_nome || request.area_nome || 'Badge';

      if (consultorInfo?.email) {
        if (shouldNotifyApproval) {
          await sendEmail({
            to: consultorInfo.email,
            subject: 'Pedido Aprovado - PINT',
            html: emailTemplates.requestApproved({
              userName: consultorInfo.nome || 'Consultor',
              badgeName,
            }),
          });
        }

        if (shouldNotifyRejection) {
          await sendEmail({
            to: consultorInfo.email,
            subject: 'Pedido Rejeitado - PINT',
            html: emailTemplates.requestRejected({
              userName: consultorInfo.nome || 'Consultor',
              badgeName,
              comment: finalDescription,
            }),
          });
        }
      }
    } catch (emailError) {
      console.error('Failed to send request decision email.', emailError);
    }
  }

  if (shouldObtainBadge) {
    try {
      await syncSpecialBadgesForConsultor(consultorId);
    } catch (error) {
      console.error('Failed to sync special badges after approval.', error);
    }
  }

  if (shouldRemoveEvidence && evidenceFilesToDelete.length > 0) {
    await deleteEvidenceFiles(evidenceFilesToDelete);
  }
};

const runScheduledSideEffects = async () => {
  await autoRejectExpiredRequests();
  try {
    const { adminBadgeModel } = await import('./adminBadgeModel.js');
    await adminBadgeModel.checkAndExpireBadges();
  } catch (e) {
    console.error('Error checking expired badges in scheduler:', e);
  }
};

export const requestManagementModel = {
  runScheduledSideEffects,
  async getManagedRequests(role, accountId) {
    const parsedRole = parseRole(role);
    if (!parsedRole) {
      const error = new Error('Invalid role.');
      error.statusCode = 400;
      throw error;
    }

    const actorUtilizadorId = await getUtilizadorIdByAccountId(accountId);
    if (!actorUtilizadorId) {
      const error = new Error('User not found for account.');
      error.statusCode = 404;
      throw error;
    }

    const rows = await fetchRequestRows({ role: parsedRole, actorUtilizadorId });
    const items = rows.map((row) => mapRequestListItem(row, parsedRole));
    return clone(items);
  },

  async getManagedRequestById(role, accountId, requestId) {
    const parsedRole = parseRole(role);
    if (!parsedRole) {
      const error = new Error('Invalid role.');
      error.statusCode = 400;
      throw error;
    }

    const actorUtilizadorId = await getUtilizadorIdByAccountId(accountId);
    if (!actorUtilizadorId) {
      const error = new Error('User not found for account.');
      error.statusCode = 404;
      throw error;
    }

    const row = await getRequestByIdForRole(parsedRole, actorUtilizadorId, requestId);
    if (!row) {
      return null;
    }

    const item = await mapRequestDetails(row, parsedRole);
    return clone(item);
  },

  async getManagedEvidenceFile(role, accountId, requestId, evidenceId) {
    const parsedRole = parseRole(role);
    if (!parsedRole) {
      const error = new Error('Invalid role.');
      error.statusCode = 400;
      throw error;
    }

    const actorUtilizadorId = await getUtilizadorIdByAccountId(accountId);
    if (!actorUtilizadorId) {
      const error = new Error('User not found for account.');
      error.statusCode = 404;
      throw error;
    }

    const row = await getRequestByIdForRole(parsedRole, actorUtilizadorId, requestId);
    if (!row) {
      return null;
    }

    const hasAccess = await ensureRoleAccessToRequest(parsedRole, actorUtilizadorId, row);
    if (!hasAccess) {
      const error = new Error('You are not allowed to download evidences from this request.');
      error.statusCode = 403;
      throw error;
    }

    const [evidence] = await sequelize.query(
      `
        SELECT nevidencias, nevidencia, formato
        FROM evidencias
        WHERE nevidencias = :evidenceId
          AND npedido = :requestId
        LIMIT 1
      `,
      {
        replacements: {
          evidenceId: Number(evidenceId),
          requestId: Number(requestId),
        },
        type: QueryTypes.SELECT,
      },
    );

    if (!evidence) {
      return null;
    }

    const storedName = path.basename(String(evidence.nevidencia || '').trim());
    if (!storedName) {
      return null;
    }

    const extension = String(evidence.formato || '').trim().toLowerCase();
    const downloadName = extension && !storedName.toLowerCase().endsWith(`.${extension}`)
      ? `${storedName}.${extension}`
      : storedName;

    return clone({
      evidenceId: Number(evidence.nevidencias),
      storedName,
      downloadName,
    });
  },

  async submitDecision(role, accountId, requestId, payload) {
    const parsedRole = parseRole(role);
    if (!parsedRole) {
      const error = new Error('Invalid role.');
      error.statusCode = 400;
      throw error;
    }

    const actorUtilizadorId = await getUtilizadorIdByAccountId(accountId);
    if (!actorUtilizadorId) {
      const error = new Error('User not found for account.');
      error.statusCode = 404;
      throw error;
    }

    const row = await getRequestByIdForRole(parsedRole, actorUtilizadorId, requestId);
    if (!row) {
      const error = new Error('Request not found.');
      error.statusCode = 404;
      throw error;
    }

    const hasAccess = await ensureRoleAccessToRequest(parsedRole, actorUtilizadorId, row);
    if (!hasAccess) {
      const error = new Error('You are not allowed to review this request.');
      error.statusCode = 403;
      throw error;
    }

    await applyDecision({
      role: parsedRole,
      actorUtilizadorId,
      request: row,
      decision: payload?.decision,
      comment: payload?.comment,
    });
    await insertManagerOwnership(parsedRole, actorUtilizadorId, requestId);

    const updated = await getRequestByIdForRole(parsedRole, actorUtilizadorId, requestId);
    if (!updated) {
      return null;
    }

    const item = await mapRequestDetails(updated, parsedRole);
    return clone(item);
  },
};
