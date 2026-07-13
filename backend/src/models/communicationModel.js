import fs from 'node:fs';
import path from 'node:path';
import { QueryTypes, Op } from 'sequelize';
import { sequelize } from '../config/database.js';
import { Account } from './sql/Account.js';
import { ServiceLine } from './sql/ServiceLine.js';
import { BadgePertenceSL } from './sql/BadgePertenceSL.js';
import { Log } from './sql/Log.js';
import { Notificacao } from './sql/Notificacao.js';
import { FicheiroLog } from './sql/FicheiroLog.js';
import { ConfigNotificacao } from './sql/ConfigNotificacao.js';
import { ConfigNotificacaoUtilizador } from './sql/ConfigNotificacaoUtilizador.js';

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

const userNotificationDefaults = [
  { field: 'emailUpdates', fallback: true },
  { field: 'inAppAlerts', fallback: true },
  { field: 'weeklySummary', fallback: false },
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

const loadUserNotificationDefaults = async () => {
  const defaults = {};
  userNotificationDefaults.forEach((item) => {
    defaults[item.field] = Boolean(item.fallback);
  });
  return defaults;
};

const fetchEventNotificationConfig = async (eventKey, transaction) => {
  const row = await ConfigNotificacao.findOne({
    where: sequelize.where(sequelize.fn('LOWER', sequelize.col('evento')), String(eventKey || '').trim().toLowerCase()),
    attributes: ['evento', 'admin', 'sll', 'tl', 'consultor', 'email', 'web_app'],
    transaction,
    raw: true,
  });

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

  const rows = await Account.findAll({
    where: {
      status: 'ativo',
      permissoes: { [Op.iLike]: `%${normalizedRole}%` },
    },
    attributes: ['id'],
    transaction,
    raw: true,
  });

  return rows.map((row) => Number(row.id)).filter((id) => Number.isInteger(id) && id > 0);
};

const listActiveUserIdsByIds = async (ids, transaction) => {
  const normalized = normalizeRecipientIds(ids);
  if (normalized.length === 0) {
    return [];
  }

  const rows = await Account.findAll({
    where: {
      id: { [Op.in]: normalized },
      status: 'ativo',
    },
    attributes: ['id'],
    transaction,
    raw: true,
  });

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

  const rows = await ConfigNotificacaoUtilizador.findAll({
    where: {
      chave: 'inAppAlerts',
      nutilizador: { [Op.in]: normalizedIds },
    },
    attributes: ['nutilizador', 'valor'],
    transaction,
    raw: true,
  });

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

  const log = await Log.create({
    nutilizador: parsedActorId,
    data_log: new Date(),
    tipo_log: normalizeLogType(type),
    titulo: trimmedTitle,
    mensagem: trimmedMessage,
    resumo: summary,
    prioridade: normalizePriority(priority),
  }, { transaction });

  return log?.nlog ? Number(log.nlog) : null;
};

const listUserNotificationOverrides = async (accountId, transaction) => {
  const rows = await ConfigNotificacaoUtilizador.findAll({
    where: { nutilizador: Number(accountId) },
    attributes: ['chave', 'valor'],
    transaction,
    raw: true,
  });

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

    const serviceLineRows = await ServiceLine.findAll({
      attributes: ['nsline', 'sline'],
      order: [['sline', 'ASC']],
      raw: true,
    });

    return {
      recipients,
      serviceLines: serviceLineRows.map((row) => ({
        id: Number(row.nsline),
        name: row.sline,
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
      const createdLog = await Log.create({
        nutilizador: parsedAccountId,
        data_log: new Date(),
        tipo_log: normalizedType,
        titulo: trimmedTitle,
        mensagem: trimmedMessage,
        resumo: summary,
        prioridade: normalizedPriority,
      }, { transaction });

      const logId = Number(createdLog?.nlog);
      if (!logId) {
        const error = new Error('Failed to create log entry.');
        error.statusCode = 500;
        throw error;
      }

      for (const recipientId of normalizedRecipients) {
        await Notificacao.create({
          nutilizador: recipientId,
          nlog: logId,
          lida: false,
        }, { transaction });
      }

      const safeFiles = Array.isArray(files) ? files : [];
      for (const file of safeFiles) {
        const storedName = path.basename(String(file?.filename || '').trim());
        const originalName = String(file?.originalname || '').trim();
        if (!storedName || !originalName) {
          continue;
        }

        await FicheiroLog.create({
          nlog: logId,
          nome_original: originalName,
          nome_armazenado: storedName,
          tipo: String(file?.mimetype || ''),
          tamanho: Number(file?.size) || 0,
          caminho: `uploads/${storedName}`,
        }, { transaction });
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
    notifyActor = false,
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

      if (notifyActor) {
        recipientSet.add(parsedActorId);
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
        await Notificacao.create({
          nutilizador: recipientId,
          nlog: logId,
          lida: false,
        }, { transaction });
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

    const notificacoes = await Notificacao.findAll({
      where: { nutilizador: parsedAccountId },
      include: [{
        model: Log,
        as: 'log',
        where: {
          tipo_log: { [Op.in]: ['mensagem', 'aviso', 'importante'] },
        },
        required: true,
        include: [{
          model: Account,
          as: 'utilizador',
          attributes: ['nome', 'email'],
          required: false,
        }],
      }],
      order: [[{ model: Log, as: 'log' }, 'data_log', 'DESC']],
    });

    const logIds = notificacoes.map((n) => Number(n.nlog)).filter((value) => Number.isInteger(value) && value > 0);
    const attachmentsByLog = new Map();

    if (logIds.length > 0) {
      const attachmentRows = await FicheiroLog.findAll({
        where: { nlog: { [Op.in]: logIds } },
        attributes: ['nflog', 'nlog', 'nome_original', 'nome_armazenado', 'tipo', 'tamanho', 'caminho'],
        order: [['nflog', 'ASC']],
        raw: true,
      });

      attachmentRows.forEach((row) => {
        const logId = Number(row.nlog);
        if (!attachmentsByLog.has(logId)) {
          attachmentsByLog.set(logId, []);
        }

        attachmentsByLog.get(logId).push({
          id: Number(row.nflog),
          logId,
          originalName: row.nome_original,
          storedName: row.nome_armazenado,
          mimeType: row.tipo,
          size: Number(row.tamanho) || 0,
          path: row.caminho,
        });
      });
    }

    return notificacoes.map((n) => {
      const log = n.log;
      const author = log?.utilizador;
      return {
        id: Number(log?.nlog),
        type: normalizeLogType(log?.tipo_log),
        title: log?.titulo || '',
        message: log?.mensagem || '',
        summary: log?.resumo || buildSummary(log?.mensagem || ''),
        priority: Number(log?.prioridade) || 2,
        date: log?.data_log,
        author: author?.nome || '',
        authorEmail: author?.email || '',
        attachments: attachmentsByLog.get(Number(log?.nlog)) || [],
      };
    });
  },

  async getUserNotifications(accountId) {
    const parsedAccountId = Number(accountId);
    if (!Number.isInteger(parsedAccountId) || parsedAccountId <= 0) {
      const error = new Error('Invalid account id.');
      error.statusCode = 400;
      throw error;
    }

    const notificacoes = await Notificacao.findAll({
      where: { nutilizador: parsedAccountId },
      include: [{
        model: Log,
        as: 'log',
        required: false,
        include: [{
          model: Account,
          as: 'utilizador',
          attributes: ['nome'],
          required: false,
        }],
      }],
      order: [
        [{ model: Log, as: 'log' }, 'data_log', 'DESC'],
        ['nnotificacao', 'DESC'],
      ],
    });

    return notificacoes.map((n) => {
      const log = n.log;
      return {
        id: Number(n.nnotificacao),
        logId: log ? Number(log.nlog) : null,
        isRead: Boolean(n.lida),
        title: log?.titulo || '',
        summary: log?.resumo || '',
        message: log?.mensagem || '',
        type: normalizeLogType(log?.tipo_log),
        date: log?.data_log,
        author: log?.utilizador?.nome || '',
      };
    });
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

    const [affectedCount] = await Notificacao.update(
      { lida: true },
      {
        where: {
          nnotificacao: parsedNotificationId,
          nutilizador: parsedAccountId,
        },
      },
    );

    return affectedCount > 0 ? parsedNotificationId : null;
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

    const notificacao = await Notificacao.findOne({
      where: {
        nutilizador: parsedAccountId,
        nlog: parsedLogId,
      },
      attributes: ['nlog'],
    });

    if (!notificacao) {
      return null;
    }

    const file = await FicheiroLog.findOne({
      where: {
        nflog: parsedFileId,
        nlog: parsedLogId,
      },
      attributes: ['nflog', 'nlog', 'nome_original', 'nome_armazenado'],
    });

    if (!file) {
      return null;
    }

    return {
      id: Number(file.nflog),
      logId: Number(file.nlog),
      originalName: file.nome_original,
      storedName: file.nome_armazenado,
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
          await ConfigNotificacaoUtilizador.destroy({
            where: {
              nutilizador: parsedAccountId,
              chave: item.field,
            },
            transaction,
          });
          continue;
        }

        await ConfigNotificacaoUtilizador.upsert({
          nutilizador: parsedAccountId,
          chave: item.field,
          valor: value,
        }, { transaction });
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
        const slRows = await BadgePertenceSL.findAll({
          where: { nbadge: badgeId },
          attributes: [[sequelize.fn('DISTINCT', sequelize.col('nsline')), 'nsline']],
          transaction,
          raw: true,
        });
        for (const row of slRows) {
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
        await Notificacao.create({
          nutilizador: recipientId,
          nlog: logId,
          lida: false,
        }, { transaction });
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
        await Notificacao.create({
          nutilizador: recipientId,
          nlog: logId,
          lida: false,
        }, { transaction });
      }

      return { logId, recipients: inAppRecipients };
    });
  },

  async isEmailEnabledForEvent(eventKey) {
    const config = await fetchEventNotificationConfig(eventKey);
    return config ? Boolean(config.email) : false;
  },
};
