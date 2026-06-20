import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/database.js';
import { Account } from './sql/Account.js';
import { communicationModel } from './communicationModel.js';
import { sendEmail } from '../services/emailService.js';
import { emailTemplates } from '../services/emailTemplates.js';

const DEFAULT_ROLE = 'consultor';
const ALLOWED_ROLES = new Set(['consultor', 'talent-manager', 'service-line-leader', 'admin-gestor']);
const ALLOWED_STATUS = new Set(['ativo', 'inativo', 'pendente']);

const normalizeEmail = (value) => value.trim().toLowerCase();

const normalizeRoles = (rolesValue) => {
  const rawRoles = Array.isArray(rolesValue)
    ? rolesValue
    : typeof rolesValue === 'string'
      ? rolesValue.split(';')
      : [];

  const parsedRoles = rawRoles
    .map((role) => String(role).trim().toLowerCase())
    .filter(Boolean);

  const uniqueRoles = [...new Set(parsedRoles)];
  return uniqueRoles.length > 0 ? uniqueRoles : [DEFAULT_ROLE];
};

const sanitizeAccount = (account, hasPreferences = false) => {
  const roles = normalizeRoles(account.permissoes ?? account.role);

  return {
    id: account.id,
    nome: account.nome,
    email: account.email,
    role: roles[0],
    roles,
    status: account.status,
    hasPreferences: Boolean(hasPreferences),
  };
};

const normalizeStatus = (statusValue, fallback = 'ativo') => {
  const normalized = String(statusValue || '').trim().toLowerCase();
  return ALLOWED_STATUS.has(normalized) ? normalized : fallback;
};

const normalizeRoleList = (rolesValue) => {
  const parsed = normalizeRoles(rolesValue).filter((role) => ALLOWED_ROLES.has(role));
  return parsed.length > 0 ? parsed : [DEFAULT_ROLE];
};

const mapUserRow = (row) => {
  const roles = normalizeRoleList(row.permissoes);
  const serviceLines = String(row.service_lines || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    id: Number(row.id),
    nome: row.nome,
    email: row.email,
    role: roles[0],
    roles,
    status: normalizeStatus(row.status, 'ativo'),
    joinedAt: row.joined_at,
    points: Number(row.points || 0),
    badges: Number(row.badges || 0),
    serviceLines,
  };
};

const syncServiceLineAssignments = async (transaction, accountId, roles, serviceLineIdsValue) => {
  const normalizedServiceLineIds = [...new Set(
    (Array.isArray(serviceLineIdsValue) ? serviceLineIdsValue : [])
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0),
  )];

  await sequelize.query(
    `
      DELETE FROM sll_leader_sl
      WHERE nutilizador = :accountId
    `,
    {
      replacements: { accountId: Number(accountId) },
      transaction,
    },
  );

  if (!roles.includes('service-line-leader') || normalizedServiceLineIds.length === 0) {
    return;
  }

  for (const serviceLineId of normalizedServiceLineIds) {
    await sequelize.query(
      `
        INSERT INTO sll_leader_sl (nutilizador, nsline)
        VALUES (:accountId, :serviceLineId)
      `,
      {
        replacements: {
          accountId: Number(accountId),
          serviceLineId,
        },
        transaction,
      },
    );
  }
};

const getAdminUsersBaseQuery = `
  SELECT
    u.nutilizador AS id,
    u.nome,
    u.email,
    u.permissoes,
    u.status,
    '2024-01-01' AS joined_at,
    COALESCE(bs.points, 0) AS points,
    COALESCE(bs.badges, 0) AS badges,
    COALESCE(sl.service_lines, '') AS service_lines
  FROM utilizador u
  LEFT JOIN (
    SELECT
      cb.nutilizador,
      SUM(COALESCE(NULLIF(cb.pontos_obtidos, 0), NULLIF(b.pontos, 0), 0)) AS points,
      COUNT(DISTINCT cb.nbadge) AS badges
    FROM c_obtem_b cb
    JOIN badge b ON b.nbadge = cb.nbadge
    GROUP BY cb.nutilizador
  ) bs ON bs.nutilizador = u.nutilizador
  LEFT JOIN (
    SELECT
      s.nutilizador,
      STRING_AGG(sl.sline, ', ' ORDER BY sl.sline) AS service_lines
    FROM sll_leader_sl s
    JOIN service_line sl ON sl.nsline = s.nsline
    GROUP BY s.nutilizador
  ) sl ON sl.nutilizador = u.nutilizador
`;

const getHasPreferences = async (accountId) => {
  if (!Number.isInteger(Number(accountId)) || Number(accountId) <= 0) {
    return false;
  }

  const [row] = await sequelize.query(
    `
      SELECT COUNT(*)::int AS total
      FROM preferencias
      WHERE nutilizador = :accountId
    `,
    {
      replacements: { accountId: Number(accountId) },
      type: QueryTypes.SELECT,
    },
  );

  return Number(row?.total) > 0;
};

export const authModel = {
  async register({ nome, email, senha }) {
    const normalizedEmail = normalizeEmail(email);

    const alreadyExists = await Account.findOne({ where: { email: normalizedEmail } });
    if (alreadyExists) {
      return null;
    }

    const account = await Account.create({
      nome: nome.trim(),
      email: normalizedEmail,
      senha,
      role: 'consultor',
      permissoes: 'consultor',
      status: 'pendente',
    });

    try {
      await communicationModel.dispatchEventNotification({
        eventKey: 'Novo registo',
        actorAccountId: account.id,
        title: 'Novo registo',
        message: `Novo registo de utilizador: ${account.nome} (${account.email}).`,
        consultorIds: [account.id],
        broadcastSll: true,
      });
    } catch (error) {
      console.error('Failed to notify new registration.', error);
    }

    return sanitizeAccount(account, false);
  },

  async login({ email, senha }) {
    const normalizedEmail = normalizeEmail(email);

    const account = await Account.findOne({ where: { email: normalizedEmail, senha } });

    if (!account) {
      return { status: 'invalid_credentials' };
    }

    const normalizedStatus = normalizeStatus(account.status, 'pendente');

    if (normalizedStatus === 'pendente') {
      const hasPreferences = await getHasPreferences(account.id);
      return {
        status: 'pending_approval',
        account: sanitizeAccount(account, hasPreferences),
      };
    }

    if (normalizedStatus === 'inativo') {
      return { status: 'inactive_account' };
    }

    const hasPreferences = await getHasPreferences(account.id);

    return {
      status: 'ok',
      account: sanitizeAccount(account, hasPreferences),
    };
  },

  async findByEmail(email) {
    const normalizedEmail = normalizeEmail(email);
    return Account.findOne({ where: { email: normalizedEmail } });
  },

  async recoverPassword(email) {
    const account = await this.findByEmail(email);
    return account ? account.senha : null;
  },

  async changePassword({ accountId, currentPassword, newPassword }) {
    const parsedAccountId = Number(accountId);
    if (!Number.isInteger(parsedAccountId) || parsedAccountId <= 0) {
      const error = new Error('Invalid account id.');
      error.statusCode = 400;
      throw error;
    }

    const account = await Account.findByPk(parsedAccountId);
    if (!account) {
      const error = new Error('Account not found.');
      error.statusCode = 404;
      throw error;
    }

    if (String(account.senha || '') !== String(currentPassword || '')) {
      const error = new Error('Current password is invalid.');
      error.statusCode = 400;
      throw error;
    }

    if (String(currentPassword || '') === String(newPassword || '')) {
      const error = new Error('New password must be different from current password.');
      error.statusCode = 400;
      throw error;
    }

    account.senha = String(newPassword || '');
    await account.save();

    try {
      await communicationModel.dispatchEventNotification({
        eventKey: 'Mudanca de credenciais',
        actorAccountId: parsedAccountId,
        title: 'Mudanca de credenciais',
        message: `O utilizador ${account.nome} alterou as credenciais de acesso.`,
        consultorIds: [parsedAccountId],
      });
    } catch (error) {
      console.error('Failed to notify credential change.', error);
    }

    return { updated: true };
  },

  async listServiceLines() {
    const rows = await sequelize.query(
      `
        SELECT nsline AS id, sline AS name
        FROM service_line
        ORDER BY sline ASC
      `,
      { type: QueryTypes.SELECT },
    );

    return rows.map((row) => ({
      id: Number(row.id),
      name: row.name,
    }));
  },

  async listAdminUsers({ tab = 'users', search = '', accountType = 'all' }) {
    const isTabPending = String(tab || '').trim().toLowerCase() === 'pending';
    const normalizedSearch = String(search || '').trim().toLowerCase();
    const normalizedAccountType = String(accountType || 'all').trim().toLowerCase();

    const query = `
      ${getAdminUsersBaseQuery}
      ORDER BY u.nutilizador ASC
    `;

    const rows = await sequelize.query(query, {
      type: QueryTypes.SELECT,
    });

    // Filter results in JavaScript to avoid complex SQL WHERE conditions
    return rows.filter((row) => {
      // Filter by tab (pending or active/inactive)
      const status = row.status?.toLowerCase() || '';
      if (isTabPending) {
        if (status !== 'pendente') return false;
      } else {
        // Show both ativo and inativo users, but not pendente
        if (status === 'pendente') return false;
      }

      // Filter by search term
      if (normalizedSearch) {
        const searchable = `${row.nome || ''} ${row.email || ''}`.toLowerCase();
        if (!searchable.includes(normalizedSearch)) return false;
      }

      // Filter by account type
      if (normalizedAccountType !== 'all') {
        const userRoles = `${row.permissoes || ''}`.toLowerCase();
        if (!userRoles.includes(normalizedAccountType)) return false;
      }

      return true;
    }).map(mapUserRow);
  },

  async createAdminUser({ nome, email, senha, roles, serviceLineIds }) {
    const trimmedName = String(nome || '').trim();
    const normalizedEmail = normalizeEmail(String(email || ''));
    const normalizedPassword = String(senha || '');
    const normalizedRoles = normalizeRoleList(roles);
    const normalizedServiceLineIds = [...new Set(
      (Array.isArray(serviceLineIds) ? serviceLineIds : [])
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0),
    )];

    if (!trimmedName || !normalizedEmail || !normalizedPassword) {
      const error = new Error('Missing required fields.');
      error.statusCode = 400;
      throw error;
    }

    // Validação: SLL só pode ser de uma service line
    if (normalizedRoles.includes('service-line-leader') && normalizedServiceLineIds.length > 1) {
      const error = new Error('Service Line Leader só pode ser associado a uma Service Line.');
      error.statusCode = 400;
      throw error;
    }

    // Validação: uma service line só pode ter um SLL
    if (normalizedRoles.includes('service-line-leader') && normalizedServiceLineIds.length === 1) {
      const existingSll = await sequelize.query(
        `
          SELECT s.nutilizador, u.nome
          FROM sll_leader_sl s
          JOIN utilizador u ON u.nutilizador = s.nutilizador
          WHERE s.nsline = :serviceLineId
          LIMIT 1
        `,
        {
          replacements: { serviceLineId: normalizedServiceLineIds[0] },
          type: QueryTypes.SELECT,
        },
      );

      if (existingSll && existingSll.length > 0) {
        const error = new Error(`Esta Service Line já tem um Service Line Leader: ${existingSll[0].nome}`);
        error.statusCode = 409;
        throw error;
      }
    }

    const transaction = await sequelize.transaction();

    try {
      const account = await Account.create(
        {
          nome: trimmedName,
          email: normalizedEmail,
          senha: normalizedPassword,
          role: normalizedRoles[0],
          permissoes: normalizedRoles.join(';'),
          status: 'ativo',
        },
        { transaction },
      );

      await syncServiceLineAssignments(transaction, account.id, normalizedRoles, normalizedServiceLineIds);
      await transaction.commit();

      const [created] = await sequelize.query(
        `
          ${getAdminUsersBaseQuery}
          WHERE u.nutilizador = :accountId
          LIMIT 1
        `,
        {
          replacements: { accountId: Number(account.id) },
          type: QueryTypes.SELECT,
        },
      );

      const mappedUser = mapUserRow(created);

      try {
        await communicationModel.dispatchEventNotification({
          eventKey: 'Novo registo',
          actorAccountId: account.id,
          title: 'Novo registo',
          message: `Novo registo de utilizador: ${mappedUser.nome} (${mappedUser.email}).`,
          consultorIds: [Number(account.id)],
          broadcastSll: true,
        });
      } catch (error) {
        console.error('Failed to notify admin-created user.', error);
      }

      return mappedUser;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async updateAdminUserPermissions(accountId, { roles, serviceLineIds }) {
    const parsedAccountId = Number(accountId);
    const normalizedRoles = normalizeRoleList(roles);
    const normalizedServiceLineIds = [...new Set(
      (Array.isArray(serviceLineIds) ? serviceLineIds : [])
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0),
    )];

    if (!Number.isInteger(parsedAccountId) || parsedAccountId <= 0) {
      const error = new Error('Invalid account id.');
      error.statusCode = 400;
      throw error;
    }

    const account = await Account.findByPk(parsedAccountId);
    if (!account) {
      const error = new Error('Account not found.');
      error.statusCode = 404;
      throw error;
    }

    // Validação: SLL só pode ser de uma service line
    if (normalizedRoles.includes('service-line-leader') && normalizedServiceLineIds.length > 1) {
      const error = new Error('Service Line Leader só pode ser associado a uma Service Line.');
      error.statusCode = 400;
      throw error;
    }

    // Validação: uma service line só pode ter um SLL
    if (normalizedRoles.includes('service-line-leader') && normalizedServiceLineIds.length === 1) {
      const existingSll = await sequelize.query(
        `
          SELECT s.nutilizador, u.nome
          FROM sll_leader_sl s
          JOIN utilizador u ON u.nutilizador = s.nutilizador
          WHERE s.nsline = :serviceLineId
            AND s.nutilizador <> :accountId
          LIMIT 1
        `,
        {
          replacements: { serviceLineId: normalizedServiceLineIds[0], accountId: parsedAccountId },
          type: QueryTypes.SELECT,
        },
      );

      if (existingSll && existingSll.length > 0) {
        const error = new Error(`Esta Service Line já tem um Service Line Leader: ${existingSll[0].nome}`);
        error.statusCode = 409;
        throw error;
      }
    }

    const transaction = await sequelize.transaction();

    try {
      // Usar ponto e vírgula como separador (consistente com o resto da aplicação)
      // O campo Sequelize 'role' é mapeado para a coluna 'permissoes' no banco
      account.role = normalizedRoles.join(';');
      await account.save({ transaction });

      await syncServiceLineAssignments(transaction, parsedAccountId, normalizedRoles, normalizedServiceLineIds);
      await transaction.commit();

      const [updated] = await sequelize.query(
        `
          ${getAdminUsersBaseQuery}
          WHERE u.nutilizador = :accountId
          LIMIT 1
        `,
        {
          replacements: { accountId: parsedAccountId },
          type: QueryTypes.SELECT,
        },
      );

      const mappedUser = mapUserRow(updated);
      const roleSummary = normalizedRoles.join(', ');
      const primaryServiceLineId = normalizedServiceLineIds[0] || null;

      try {
        await communicationModel.dispatchEventNotification({
          eventKey: 'Alteracao de permissoes',
          actorAccountId: parsedAccountId,
          title: 'Permissoes atualizadas',
          message: `As permissoes de ${mappedUser.nome} foram atualizadas para ${roleSummary}.`,
          consultorIds: [parsedAccountId],
          serviceLineId: primaryServiceLineId,
        });
      } catch (error) {
        console.error('Failed to notify permission update.', error);
      }

      return mappedUser;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async updateAdminUserStatus(accountId, { status }) {
    const parsedAccountId = Number(accountId);
    const normalizedStatus = normalizeStatus(status, 'ativo');

    if (!Number.isInteger(parsedAccountId) || parsedAccountId <= 0) {
      const error = new Error('Invalid account id.');
      error.statusCode = 400;
      throw error;
    }

    const account = await Account.findByPk(parsedAccountId);
    if (!account) {
      const error = new Error('Account not found.');
      error.statusCode = 404;
      throw error;
    }

    account.status = normalizedStatus;
    await account.save();

    const [updated] = await sequelize.query(
      `
        ${getAdminUsersBaseQuery}
        WHERE u.nutilizador = :accountId
        LIMIT 1
      `,
      {
        replacements: { accountId: parsedAccountId },
        type: QueryTypes.SELECT,
      },
    );

    return mapUserRow(updated);
  },

  async decidePendingUser(accountId, { decision }) {
    const normalizedDecision = String(decision || '').trim().toLowerCase();

    if (!['approve', 'reject'].includes(normalizedDecision)) {
      const error = new Error('Invalid decision.');
      error.statusCode = 400;
      throw error;
    }

    if (normalizedDecision === 'approve') {
      // Approve: set status to 'ativo'
      // Fetch user info before approval for email
      const [userInfo] = await sequelize.query(
        'SELECT nome, email FROM utilizador WHERE nutilizador = :accountId LIMIT 1',
        {
          replacements: { accountId: Number(accountId) },
          type: QueryTypes.SELECT,
        }
      );

      const result = this.updateAdminUserStatus(accountId, { status: 'ativo' });

      // Send approval email
      if (userInfo?.email) {
        try {
          await sendEmail({
            to: userInfo.email,
            subject: 'Conta Aprovada - PINT',
            html: emailTemplates.registrationApproved({ userName: userInfo.nome || 'Utilizador' }),
          });
        } catch (emailError) {
          console.error('Failed to send registration approval email.', emailError);
        }
      }

      return result;
    } else {
      // Reject: delete the user from database
      const result = await sequelize.query(
        'DELETE FROM utilizador WHERE nutilizador = :accountId',
        {
          replacements: { accountId: Number(accountId) },
          type: QueryTypes.DELETE,
        }
      );
      
      if (result[0] === 0) {
        const error = new Error('User not found.');
        error.statusCode = 404;
        throw error;
      }
      
      return { deleted: true, id: accountId };
    }
  },
};
