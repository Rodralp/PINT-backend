import fs from 'node:fs';
import path from 'node:path';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const uploadsDir = path.resolve(globalThis.process?.cwd?.() || '.', 'uploads');
const allowedLogTypes = new Set(['mensagem', 'aviso', 'importante', 'evento']);

const normalizeRoles = (rolesValue) => {
  const rawRoles = Array.isArray(rolesValue)
    ? rolesValue
    : typeof rolesValue === 'string'
      ? rolesValue.split(';')
      : [];

  return rawRoles
    .map((role) => String(role).trim().toLowerCase())
    .filter(Boolean);
};

const normalizeServiceLines = (value) => {
  return String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const buildSummary = (message) => {
  const trimmed = String(message || '').trim();
  if (!trimmed) {
    return '';
  }

  if (trimmed.length <= 120) {
    return trimmed;
  }

  return `${trimmed.slice(0, 117).trim()}...`;
};

const normalizeLogType = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return allowedLogTypes.has(normalized) ? normalized : 'mensagem';
};

const normalizePriority = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 2;
};

const normalizeRecipientIds = (ids) => {
  const raw = Array.isArray(ids) ? ids : [];
  return [...new Set(raw
    .map((entry) => Number(entry))
    .filter((entry) => Number.isInteger(entry) && entry > 0))];
};

const normalizeEventKey = (value) => String(value ?? '').trim().toLowerCase();

const eventNotificationDefaults = [
  {
    event: 'Novo registo',
    admin: true,
    sll: true,
    tl: false,
    consultor: false,
    email: true,
    webApp: true,
  },
  {
    event: 'Alteracao de permissoes',
    admin: true,
    sll: true,
    tl: true,
    consultor: true,
    email: true,
    webApp: true,
  },
  {
    event: 'Recebe badge',
    admin: false,
    sll: false,
    tl: false,
    consultor: true,
    email: true,
    webApp: true,
  },
  {
    event: 'Mudanca de credenciais',
    admin: false,
    sll: true,
    tl: true,
    consultor: false,
    email: true,
    webApp: false,
  },
  {
    event: 'Pedido aprovado',
    admin: true,
    sll: true,
    tl: true,
    consultor: true,
    email: true,
    webApp: true,
  },
  {
    event: 'Pedido rejeitado',
    admin: true,
    sll: true,
    tl: true,
    consultor: true,
    email: true,
    webApp: true,
  },
  {
    event: 'Badge a expirar',
    admin: true,
    sll: true,
    tl: true,
    consultor: true,
    email: false,
    webApp: true,
  },
  {
    event: 'Badge expirada',
    admin: true,
    sll: true,
    tl: true,
    consultor: true,
    email: false,
    webApp: true,
  },
];

const userNotificationDefaults = [
  { field: 'emailUpdates', generalKey: 'Notificacoes email', fallback: true },
  { field: 'inAppAlerts', generalKey: 'Notificacoes in-app', fallback: true },
  { field: 'weeklySummary', generalKey: 'Resumo semanal', fallback: false },
];

const userNotificationOptions = ['Ativo', 'Inativo'];

const toGeneralBooleanValue = (value) => (value ? 'Ativo' : 'Inativo');

const parseGeneralBoolean = (value, fallback) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    if (value === 1) {
      return true;
    }
    if (value === 0) {
      return false;
    }
  }

  const normalized = String(value ?? '').trim().toLowerCase();
  if (['ativo', 'true', '1', 'sim', 'yes', 'y'].includes(normalized)) {
    return true;
  }
  if (['inativo', 'false', '0', 'nao', 'no', 'n'].includes(normalized)) {
    return false;
  }

  return fallback;
};

const ensureUserNotificationDefaults = async (transaction) => {
  for (const item of userNotificationDefaults) {
    await sequelize.query(
      `
        INSERT INTO config_geral (chave, valor, opcoes)
        VALUES (:key, :value, ARRAY[:options]::TEXT[])
        ON CONFLICT (chave) DO NOTHING
      `,
      {
        replacements: {
          key: item.generalKey,
          value: toGeneralBooleanValue(item.fallback),
          options: userNotificationOptions,
        },
        type: QueryTypes.INSERT,
        transaction,
      },
    );
  }
};

const loadUserNotificationDefaults = async (transaction) => {
  await ensureUserNotificationDefaults(transaction);

  const keys = userNotificationDefaults.map((item) => item.generalKey);
  const rows = await sequelize.query(
    `
      SELECT chave, valor
      FROM config_geral
      WHERE chave IN (:keys)
    `,
    {
      replacements: { keys },
      type: QueryTypes.SELECT,
      transaction,
    },
  );

  const valueByKey = new Map((rows || []).map((row) => [row.chave, row.valor]));
  const defaults = {};

  userNotificationDefaults.forEach((item) => {
    defaults[item.field] = parseGeneralBoolean(valueByKey.get(item.generalKey), item.fallback);
  });

  return defaults;
};

const ensureEventNotificationDefaults = async (transaction) => {
  const rows = await sequelize.query(
    'SELECT evento FROM config_notificacao',
    { type: QueryTypes.SELECT, transaction },
  );
  const existingEvents = new Set(
    (rows || []).map((row) => normalizeEventKey(row?.evento)),
  );

  const validEvents = new Set(
    eventNotificationDefaults.map((item) => normalizeEventKey(item.event)),
  );

  for (const existingEvent of existingEvents) {
    if (!validEvents.has(existingEvent)) {
      await sequelize.query(
        'DELETE FROM config_notificacao WHERE LOWER(evento) = :evento',
        { replacements: { evento: existingEvent }, type: QueryTypes.DELETE, transaction },
      );
    }
  }

  for (const item of eventNotificationDefaults) {
    const eventKey = normalizeEventKey(item.event);
    if (existingEvents.has(eventKey)) {
      await sequelize.query(
        `UPDATE config_notificacao SET admin = :admin, sll = :sll, tl = :tl, consultor = :consultor, email = :email, web_app = :webApp WHERE LOWER(evento) = :eventKey`,
        {
          replacements: {
            admin: item.admin,
            sll: item.sll,
            tl: item.tl,
            consultor: item.consultor,
            email: item.email,
            webApp: item.webApp,
            eventKey,
          },
          type: QueryTypes.UPDATE,
          transaction,
        },
      );
      continue;
    }

    await sequelize.query(
      `
        INSERT INTO config_notificacao (evento, admin, sll, tl, consultor, email, web_app)
        VALUES (:event, :admin, :sll, :tl, :consultor, :email, :webApp)
      `,
      {
        replacements: {
          event: item.event,
          admin: item.admin,
          sll: item.sll,
          tl: item.tl,
          consultor: item.consultor,
          email: item.email,
          webApp: item.webApp,
        },
        type: QueryTypes.INSERT,
        transaction,
      },
    );

    existingEvents.add(eventKey);
  }
};

const fetchEventNotificationConfig = async (eventKey, transaction) => {
  await ensureEventNotificationDefaults(transaction);

  const [row] = await sequelize.query(
    `
      SELECT evento, admin, sll, tl, consultor, email, web_app
      FROM config_notificacao
      WHERE LOWER(evento) = LOWER(:eventKey)
      LIMIT 1
    `,
    {
      replacements: { eventKey: String(eventKey || '').trim() },
      type: QueryTypes.SELECT,
      transaction,
    },
  );

  if (!row) {
    return null;
  }

  return {
    event: row.evento,
    admin: Boolean(row.admin),
    sll: Boolean(row.sll),
    tl: Boolean(row.tl),
    consultor: Boolean(row.consultor),
    email: Boolean(row.email),
    webApp: Boolean(row.web_app),
  };
};

const listActiveUserIdsByRole = async (roleKey, transaction) => {
  const normalizedRole = String(roleKey || '').trim().toLowerCase();
  if (!normalizedRole) {
    return [];
  }

  const rows = await sequelize.query(
    `
      SELECT nutilizador AS id
      FROM utilizador
      WHERE LOWER(status) = 'ativo'
        AND LOWER(permissoes) LIKE :rolePattern
    `,
    {
      replacements: { rolePattern: `%${normalizedRole}%` },
      type: QueryTypes.SELECT,
      transaction,
    },
  );

  return rows.map((row) => Number(row.id)).filter((id) => Number.isInteger(id) && id > 0);
};

const listActiveUserIdsByIds = async (ids, transaction) => {
  const normalized = normalizeRecipientIds(ids);
  if (normalized.length === 0) {
    return [];
  }

  const rows = await sequelize.query(
    `
      SELECT nutilizador AS id
      FROM utilizador
      WHERE nutilizador IN (:ids)
        AND LOWER(status) = 'ativo'
    `,
    {
      replacements: { ids: normalized },
      type: QueryTypes.SELECT,
      transaction,
    },
  );

  return rows.map((row) => Number(row.id)).filter((id) => Number.isInteger(id) && id > 0);
};

const listSllIdsByServiceLine = async (serviceLineId, transaction) => {
  const parsedServiceLineId = Number(serviceLineId);
  if (!Number.isInteger(parsedServiceLineId) || parsedServiceLineId <= 0) {
    return [];
  }

  const rows = await sequelize.query(
    `
      SELECT s.nutilizador AS id
      FROM sll_leader_sl AS s
      INNER JOIN utilizador AS u
        ON u.nutilizador = s.nutilizador
      WHERE s.nsline = :serviceLineId
        AND LOWER(u.status) = 'ativo'
    `,
    {
      replacements: { serviceLineId: parsedServiceLineId },
      type: QueryTypes.SELECT,
      transaction,
    },
  );

  return rows.map((row) => Number(row.id)).filter((id) => Number.isInteger(id) && id > 0);
};

const filterRecipientsByInAppPreference = async (recipientIds, transaction) => {
  const normalizedIds = normalizeRecipientIds(recipientIds);
  if (normalizedIds.length === 0) {
    return [];
  }

  const defaults = await loadUserNotificationDefaults(transaction);
  const defaultInApp = Boolean(defaults.inAppAlerts);

  const rows = await sequelize.query(
    `
      SELECT nutilizador, valor
      FROM config_notificacao_utilizador
      WHERE chave = 'inAppAlerts'
        AND nutilizador IN (:ids)
    `,
    {
      replacements: { ids: normalizedIds },
      type: QueryTypes.SELECT,
      transaction,
    },
  );

  const overrideById = new Map(
    rows.map((row) => [Number(row.nutilizador), Boolean(row.valor)]),
  );

  return normalizedIds.filter((id) => (
    overrideById.has(id) ? overrideById.get(id) : defaultInApp
  ));
};

const insertLogEntry = async ({ actorId, title, message, type, priority, transaction }) => {
  const parsedActorId = Number(actorId);
  if (!Number.isInteger(parsedActorId) || parsedActorId <= 0) {
    const error = new Error('Invalid actor id for log entry.');
    error.statusCode = 400;
    throw error;
  }

  const trimmedTitle = String(title || '').trim() || '';
  const trimmedMessage = String(message || '').trim();
  const summary = buildSummary(trimmedMessage);

  const [row] = await sequelize.query(
    `
      INSERT INTO logs (nutilizador, data_log, tipo_log, titulo, mensagem, resumo, prioridade)
      VALUES (:actorId, CURRENT_DATE, :type, :title, :message, :summary, :priority)
      RETURNING nlog
    `,
    {
      replacements: {
        actorId: parsedActorId,
        type: normalizeLogType(type),
        title: trimmedTitle,
        message: trimmedMessage,
        summary,
        priority: normalizePriority(priority),
      },
      type: QueryTypes.SELECT,
      transaction,
    },
  );

  return row?.nlog ? Number(row.nlog) : null;
};

const listUserNotificationOverrides = async (accountId, transaction) => {
  const rows = await sequelize.query(
    `
      SELECT chave, valor
      FROM config_notificacao_utilizador
      WHERE nutilizador = :accountId
    `,
    {
      replacements: { accountId: Number(accountId) },
      type: QueryTypes.SELECT,
      transaction,
    },
  );

  const overrides = {};
  (rows || []).forEach((row) => {
    overrides[row.chave] = Boolean(row.valor);
  });

  return overrides;
};

const deleteUploadedFiles = async (files) => {
  const safeFiles = Array.isArray(files) ? files : [];
  await Promise.all(safeFiles.map(async (file) => {
    const storedName = path.basename(String(file?.filename || '').trim());
    if (!storedName) {
      return;
    }

    const resolvedPath = path.resolve(uploadsDir, storedName);
    const isInsideUploadsDir = resolvedPath === uploadsDir || resolvedPath.startsWith(`${uploadsDir}${path.sep}`);
    if (!isInsideUploadsDir) {
      return;
    }

    try {
      await fs.promises.unlink(resolvedPath);
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        // Ignore cleanup errors to keep best-effort behavior.
      }
    }
  }));
};

export const communicationModel = {
  async listRecipients() {
    const rows = await sequelize.query(
      `
        SELECT
          u.nutilizador AS id,
          u.nome,
          u.email,
          u.permissoes,
          u.status,
          COALESCE(sl.service_lines, '') AS service_lines
        FROM utilizador u
        LEFT JOIN (
          SELECT
            s.nutilizador,
            STRING_AGG(sl.sline, ', ' ORDER BY sl.sline) AS service_lines
          FROM sll_leader_sl s
          JOIN service_line sl ON sl.nsline = s.nsline
          GROUP BY s.nutilizador
        ) sl ON sl.nutilizador = u.nutilizador
        WHERE LOWER(u.status) <> 'pendente'
        ORDER BY u.nome ASC
      `,
      { type: QueryTypes.SELECT },
    );

    const recipients = rows.map((row) => {
      const roles = normalizeRoles(row.permissoes);
      const serviceLines = normalizeServiceLines(row.service_lines);

      return {
        id: Number(row.id),
        nome: row.nome,
        email: row.email,
        role: roles[0] || 'consultor',
        roles,
        status: row.status,
        serviceLines,
      };
    });

    const serviceLineRows = await sequelize.query(
      `
        SELECT nsline AS id, sline AS name
        FROM service_line
        ORDER BY sline ASC
      `,
      { type: QueryTypes.SELECT },
    );

    return {
      recipients,
      serviceLines: serviceLineRows.map((row) => ({
        id: Number(row.id),
        name: row.name,
      })),
    };
  },

  async createAnnouncement({ accountId, title, message, type, priority, recipientIds, files }) {
    const parsedAccountId = Number(accountId);
    if (!Number.isInteger(parsedAccountId) || parsedAccountId <= 0) {
      const error = new Error('Invalid account id.');
      error.statusCode = 400;
      throw error;
    }

    const trimmedTitle = String(title || '').trim();
    const trimmedMessage = String(message || '').trim();
    if (!trimmedTitle || !trimmedMessage) {
      const error = new Error('Missing required fields.');
      error.statusCode = 400;
      throw error;
    }

    const normalizedRecipients = normalizeRecipientIds(recipientIds);
    if (normalizedRecipients.length === 0) {
      const error = new Error('At least one recipient is required.');
      error.statusCode = 400;
      throw error;
    }

    const normalizedType = normalizeLogType(type);
    const normalizedPriority = normalizePriority(priority);
    const summary = buildSummary(trimmedMessage);
    const transaction = await sequelize.transaction();

    try {
      const [createdLog] = await sequelize.query(
        `
          INSERT INTO logs (nutilizador, data_log, tipo_log, titulo, mensagem, resumo, prioridade)
          VALUES (:accountId, CURRENT_DATE, :type, :title, :message, :summary, :priority)
          RETURNING nlog, data_log
        `,
        {
          replacements: {
            accountId: parsedAccountId,
            type: normalizedType,
            title: trimmedTitle,
            message: trimmedMessage,
            summary,
            priority: normalizedPriority,
          },
          type: QueryTypes.SELECT,
          transaction,
        },
      );

      const logId = Number(createdLog?.nlog);
      if (!logId) {
        const error = new Error('Failed to create log entry.');
        error.statusCode = 500;
        throw error;
      }

      for (const recipientId of normalizedRecipients) {
        await sequelize.query(
          `
            INSERT INTO notificacao (nutilizador, nlog, lida)
            VALUES (:recipientId, :logId, FALSE)
          `,
          {
            replacements: {
              recipientId,
              logId,
            },
            type: QueryTypes.INSERT,
            transaction,
          },
        );
      }

      const safeFiles = Array.isArray(files) ? files : [];
      for (const file of safeFiles) {
        const storedName = path.basename(String(file?.filename || '').trim());
        const originalName = String(file?.originalname || '').trim();
        if (!storedName || !originalName) {
          continue;
        }

        await sequelize.query(
          `
            INSERT INTO ficheiro_log (nlog, nome_original, nome_armazenado, tipo, tamanho, caminho)
            VALUES (:logId, :originalName, :storedName, :mimeType, :fileSize, :filePath)
          `,
          {
            replacements: {
              logId,
              originalName,
              storedName,
              mimeType: String(file?.mimetype || ''),
              fileSize: Number(file?.size) || 0,
              filePath: `uploads/${storedName}`,
            },
            type: QueryTypes.INSERT,
            transaction,
          },
        );
      }

      await transaction.commit();

      return {
        id: logId,
        date: createdLog?.data_log || null,
      };
    } catch (error) {
      await transaction.rollback();
      await deleteUploadedFiles(files);
      throw error;
    }
  },

  async dispatchEventNotification({
    eventKey,
    actorAccountId,
    title,
    message,
    type = 'evento',
    priority = 2,
    consultorIds = [],
    serviceLineId = null,
    broadcastConsultors = false,
    broadcastSll = false,
  }) {
    const normalizedEventKey = String(eventKey || '').trim();
    if (!normalizedEventKey) {
      return null;
    }

    const parsedActorId = Number(actorAccountId);
    if (!Number.isInteger(parsedActorId) || parsedActorId <= 0) {
      const error = new Error('Invalid actor id for event notification.');
      error.statusCode = 400;
      throw error;
    }

    return sequelize.transaction(async (transaction) => {
      const config = await fetchEventNotificationConfig(normalizedEventKey, transaction);
      if (!config) {
        return null;
      }

      const recipientSet = new Set();

      if (config.admin) {
        const adminIds = await listActiveUserIdsByRole('admin-gestor', transaction);
        adminIds.forEach((id) => recipientSet.add(id));
      }

      if (config.tl) {
        const tmIds = await listActiveUserIdsByRole('talent-manager', transaction);
        tmIds.forEach((id) => recipientSet.add(id));
      }

      if (config.sll) {
        const sllIds = serviceLineId
          ? await listSllIdsByServiceLine(serviceLineId, transaction)
          : broadcastSll
            ? await listActiveUserIdsByRole('service-line-leader', transaction)
            : [];
        sllIds.forEach((id) => recipientSet.add(id));
      }

      if (config.consultor) {
        const consultorIdList = normalizeRecipientIds(consultorIds);
        const consultorRecipients = consultorIdList.length > 0
          ? await listActiveUserIdsByIds(consultorIdList, transaction)
          : broadcastConsultors
            ? await listActiveUserIdsByRole('consultor', transaction)
            : [];
        consultorRecipients.forEach((id) => recipientSet.add(id));
      }

      const recipients = Array.from(recipientSet);
      const logId = await insertLogEntry({
        actorId: parsedActorId,
        title,
        message,
        type,
        priority,
        transaction,
      });

      if (!logId || recipients.length === 0 || !config.webApp) {
        return { logId, recipients: [] };
      }

      const inAppRecipients = await filterRecipientsByInAppPreference(recipients, transaction);
      for (const recipientId of inAppRecipients) {
        await sequelize.query(
          `
            INSERT INTO notificacao (nutilizador, nlog, lida)
            VALUES (:recipientId, :logId, FALSE)
          `,
          {
            replacements: {
              recipientId,
              logId,
            },
            type: QueryTypes.INSERT,
            transaction,
          },
        );
      }

      return { logId, recipients: inAppRecipients };
    });
  },

  async getUserAnnouncements(accountId) {
    const parsedAccountId = Number(accountId);
    if (!Number.isInteger(parsedAccountId) || parsedAccountId <= 0) {
      const error = new Error('Invalid account id.');
      error.statusCode = 400;
      throw error;
    }

    const rows = await sequelize.query(
      `
        SELECT
          l.nlog AS id,
          l.titulo,
          l.mensagem,
          l.resumo,
          l.tipo_log,
          l.prioridade,
          l.data_log,
          u.nome AS author_name,
          u.email AS author_email
        FROM notificacao n
        JOIN logs l ON l.nlog = n.nlog
        LEFT JOIN utilizador u ON u.nutilizador = l.nutilizador
        WHERE n.nutilizador = :accountId
          AND LOWER(l.tipo_log) IN ('mensagem', 'aviso', 'importante')
        ORDER BY l.data_log DESC, l.nlog DESC
      `,
      {
        replacements: { accountId: parsedAccountId },
        type: QueryTypes.SELECT,
      },
    );

    const logIds = rows.map((row) => Number(row.id)).filter((value) => Number.isInteger(value) && value > 0);
    const attachmentsByLog = new Map();

    if (logIds.length > 0) {
      const attachmentRows = await sequelize.query(
        `
          SELECT
            nflog AS id,
            nlog,
            nome_original,
            nome_armazenado,
            tipo,
            tamanho,
            caminho
          FROM ficheiro_log
          WHERE nlog IN (:logIds)
          ORDER BY nflog ASC
        `,
        {
          replacements: { logIds },
          type: QueryTypes.SELECT,
        },
      );

      attachmentRows.forEach((row) => {
        const logId = Number(row.nlog);
        if (!attachmentsByLog.has(logId)) {
          attachmentsByLog.set(logId, []);
        }

        attachmentsByLog.get(logId).push({
          id: Number(row.id),
          logId,
          originalName: row.nome_original,
          storedName: row.nome_armazenado,
          mimeType: row.tipo,
          size: Number(row.tamanho) || 0,
          path: row.caminho,
        });
      });
    }

    return rows.map((row) => ({
      id: Number(row.id),
      type: normalizeLogType(row.tipo_log),
      title: row.titulo || '',
      message: row.mensagem || '',
      summary: row.resumo || buildSummary(row.mensagem || ''),
      priority: Number(row.prioridade) || 2,
      date: row.data_log,
      author: row.author_name || '',
      authorEmail: row.author_email || '',
      attachments: attachmentsByLog.get(Number(row.id)) || [],
    }));
  },

  async getUserNotifications(accountId) {
    const parsedAccountId = Number(accountId);
    if (!Number.isInteger(parsedAccountId) || parsedAccountId <= 0) {
      const error = new Error('Invalid account id.');
      error.statusCode = 400;
      throw error;
    }

    const rows = await sequelize.query(
      `
        SELECT
          n.nnotificacao AS id,
          n.lida,
          l.nlog AS log_id,
          l.titulo,
          l.resumo,
          l.mensagem,
          l.tipo_log,
          l.data_log,
          u.nome AS author_name
        FROM notificacao n
        LEFT JOIN logs l ON l.nlog = n.nlog
        LEFT JOIN utilizador u ON u.nutilizador = l.nutilizador
        WHERE n.nutilizador = :accountId
        ORDER BY l.data_log DESC NULLS LAST, n.nnotificacao DESC
      `,
      {
        replacements: { accountId: parsedAccountId },
        type: QueryTypes.SELECT,
      },
    );

    return rows.map((row) => ({
      id: Number(row.id),
      logId: row.log_id ? Number(row.log_id) : null,
      isRead: Boolean(row.lida),
      title: row.titulo || '',
      summary: row.resumo || '',
      message: row.mensagem || '',
      type: normalizeLogType(row.tipo_log),
      date: row.data_log,
      author: row.author_name || '',
    }));
  },

  async markNotificationRead(accountId, notificationId) {
    const parsedAccountId = Number(accountId);
    const parsedNotificationId = Number(notificationId);

    if (!Number.isInteger(parsedAccountId) || parsedAccountId <= 0) {
      const error = new Error('Invalid account id.');
      error.statusCode = 400;
      throw error;
    }

    if (!Number.isInteger(parsedNotificationId) || parsedNotificationId <= 0) {
      const error = new Error('Invalid notification id.');
      error.statusCode = 400;
      throw error;
    }

    const [updated] = await sequelize.query(
      `
        UPDATE notificacao
        SET lida = TRUE
        WHERE nnotificacao = :notificationId
          AND nutilizador = :accountId
        RETURNING nnotificacao
      `,
      {
        replacements: {
          notificationId: parsedNotificationId,
          accountId: parsedAccountId,
        },
        type: QueryTypes.SELECT,
      },
    );

    return updated ? Number(updated.nnotificacao) : null;
  },

  async getAnnouncementAttachment(accountId, logId, fileId) {
    const parsedAccountId = Number(accountId);
    const parsedLogId = Number(logId);
    const parsedFileId = Number(fileId);

    if (!Number.isInteger(parsedAccountId) || parsedAccountId <= 0) {
      const error = new Error('Invalid account id.');
      error.statusCode = 400;
      throw error;
    }

    if (!Number.isInteger(parsedLogId) || parsedLogId <= 0) {
      const error = new Error('Invalid log id.');
      error.statusCode = 400;
      throw error;
    }

    if (!Number.isInteger(parsedFileId) || parsedFileId <= 0) {
      const error = new Error('Invalid file id.');
      error.statusCode = 400;
      throw error;
    }

    const [row] = await sequelize.query(
      `
        SELECT
          f.nflog AS id,
          f.nlog,
          f.nome_original,
          f.nome_armazenado
        FROM ficheiro_log f
        JOIN notificacao n ON n.nlog = f.nlog
        WHERE n.nutilizador = :accountId
          AND f.nlog = :logId
          AND f.nflog = :fileId
        LIMIT 1
      `,
      {
        replacements: {
          accountId: parsedAccountId,
          logId: parsedLogId,
          fileId: parsedFileId,
        },
        type: QueryTypes.SELECT,
      },
    );

    if (!row) {
      return null;
    }

    return {
      id: Number(row.id),
      logId: Number(row.nlog),
      originalName: row.nome_original,
      storedName: row.nome_armazenado,
    };
  },

  async getUserNotificationSettings(accountId) {
    const parsedAccountId = Number(accountId);
    if (!Number.isInteger(parsedAccountId) || parsedAccountId <= 0) {
      const error = new Error('Invalid account id.');
      error.statusCode = 400;
      throw error;
    }

    return sequelize.transaction(async (transaction) => {
      const defaults = await loadUserNotificationDefaults(transaction);
      const overrides = await listUserNotificationOverrides(parsedAccountId, transaction);
      const settings = { ...defaults, ...overrides };

      return { settings, defaults };
    });
  },

  async updateUserNotificationSettings(accountId, settings) {
    const parsedAccountId = Number(accountId);
    if (!Number.isInteger(parsedAccountId) || parsedAccountId <= 0) {
      const error = new Error('Invalid account id.');
      error.statusCode = 400;
      throw error;
    }

    const payload = settings && typeof settings === 'object' ? settings : {};

    return sequelize.transaction(async (transaction) => {
      const defaults = await loadUserNotificationDefaults(transaction);

      for (const item of userNotificationDefaults) {
        const value = payload[item.field];
        const shouldOverride = typeof value === 'boolean' && value !== defaults[item.field];

        if (!shouldOverride) {
          await sequelize.query(
            `
              DELETE FROM config_notificacao_utilizador
              WHERE nutilizador = :accountId
                AND chave = :key
            `,
            {
              replacements: {
                accountId: parsedAccountId,
                key: item.field,
              },
              type: QueryTypes.DELETE,
              transaction,
            },
          );
          continue;
        }

        await sequelize.query(
          `
            INSERT INTO config_notificacao_utilizador (nutilizador, chave, valor)
            VALUES (:accountId, :key, :value)
            ON CONFLICT (nutilizador, chave)
            DO UPDATE SET valor = EXCLUDED.valor
          `,
          {
            replacements: {
              accountId: parsedAccountId,
              key: item.field,
              value,
            },
            type: QueryTypes.INSERT,
            transaction,
          },
        );
      }

      const overrides = await listUserNotificationOverrides(parsedAccountId, transaction);
      const mergedSettings = { ...defaults, ...overrides };

      return { settings: mergedSettings, defaults };
    });
  },

  async dispatchBadgeExpiredNotification(badgeId, badgeName) {
    return sequelize.transaction(async (transaction) => {
      const eventKey = 'Badge expirada';
      const config = await fetchEventNotificationConfig(eventKey, transaction);
      if (!config) {
        return null;
      }

      const recipientSet = new Set();

      if (config.admin) {
        const adminIds = await listActiveUserIdsByRole('admin-gestor', transaction);
        adminIds.forEach((id) => recipientSet.add(id));
      }

      if (config.tl) {
        const tmIds = await listActiveUserIdsByRole('talent-manager', transaction);
        tmIds.forEach((id) => recipientSet.add(id));
      }

      if (config.sll) {
        const serviceLineRows = await sequelize.query(
          `SELECT DISTINCT nsline FROM b_pertence_sl WHERE nbadge = :badgeId`,
          { replacements: { badgeId }, type: QueryTypes.SELECT, transaction }
        );
        for (const row of serviceLineRows) {
          const sllIds = await listSllIdsByServiceLine(row.nsline, transaction);
          sllIds.forEach((id) => recipientSet.add(id));
        }
      }

      if (config.consultor) {
        const consultorRows = await sequelize.query(
          `
            SELECT DISTINCT nutilizador AS id FROM c_obtem_b WHERE nbadge = :badgeId
            UNION
            SELECT DISTINCT nutilizador AS id FROM pedidos WHERE nbadge = :badgeId
          `,
          { replacements: { badgeId }, type: QueryTypes.SELECT, transaction }
        );
        const consultorIds = consultorRows.map((r) => Number(r.id)).filter((id) => Number.isInteger(id) && id > 0);
        if (consultorIds.length > 0) {
          const activeConsultors = await listActiveUserIdsByIds(consultorIds, transaction);
          activeConsultors.forEach((id) => recipientSet.add(id));
        }
      }

      const recipients = Array.from(recipientSet);
      if (recipients.length === 0) {
        return { logId: null, recipients: [] };
      }

      const logTitle = `Badge "${badgeName}" expirou`;
      const logMessage = `A badge "${badgeName}" expirou. As candidaturas pendentes foram rejeitadas automaticamente.`;
      const logId = await insertLogEntry({
        actorId: recipients[0],
        title: logTitle,
        message: logMessage,
        type: 'evento',
        priority: 2,
        transaction,
      });

      if (!logId || !config.webApp) {
        return { logId, recipients: [] };
      }

      const inAppRecipients = await filterRecipientsByInAppPreference(recipients, transaction);
      for (const recipientId of inAppRecipients) {
        await sequelize.query(
          `INSERT INTO notificacao (nutilizador, nlog, lida) VALUES (:recipientId, :logId, FALSE)`,
          { replacements: { recipientId, logId }, type: QueryTypes.INSERT, transaction }
        );
      }

      return { logId, recipients: inAppRecipients };
    });
  },

  async dispatchBadgeExpiringNotification(recipientIds, badgeName, daysUntilExpiration) {
    return sequelize.transaction(async (transaction) => {
      const eventKey = 'Badge a expirar';
      const config = await fetchEventNotificationConfig(eventKey, transaction);

      if (!config) {
        return null;
      }

      const recipients = Array.isArray(recipientIds) ? recipientIds : [recipientIds];
      if (recipients.length === 0) {
        return { logId: null, recipients: [] };
      }

      const logTitle = `Badge a expirar: ${badgeName} (${daysUntilExpiration} dias)`;
      const logMessage = `A badge "${badgeName}" irá expirar em ${daysUntilExpiration} dias. Certifique-se de que utilizou os seus benefícios antes da data de expiração.`;

      const logId = await insertLogEntry({
        actorId: recipients[0],
        title: logTitle,
        message: logMessage,
        type: 'evento',
        priority: 2,
        transaction,
      });

      if (!logId || !config.webApp) {
        return { logId, recipients: [] };
      }

      const inAppRecipients = await filterRecipientsByInAppPreference(recipients, transaction);
      for (const recipientId of inAppRecipients) {
        await sequelize.query(
          `INSERT INTO notificacao (nutilizador, nlog, lida) VALUES (:recipientId, :logId, FALSE)`,
          { replacements: { recipientId, logId }, type: QueryTypes.INSERT, transaction }
        );
      }

      return { logId, recipients: inAppRecipients };
    });
  },
};
