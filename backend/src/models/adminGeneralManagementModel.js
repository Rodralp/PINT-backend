import { Op } from 'sequelize';
import { sequelize } from '../config/database.js';
import { ConfigNotificacao } from './sql/ConfigNotificacao.js';
import { RgpdTopico } from './sql/RgpdTopico.js';

const defaultNotificationRows = [
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
    admin: false,
    sll: false,
    tl: false,
    consultor: true,
    email: true,
    webApp: true,
  },
  {
    event: 'Pedido rejeitado',
    admin: false,
    sll: false,
    tl: false,
    consultor: true,
    email: true,
    webApp: true,
  },
  {
    event: 'Badge a expirar',
    admin: false,
    sll: false,
    tl: false,
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

const EMAIL_SUPPORTED_EVENTS = new Set([
  'novo registo',
  'pedido aprovado',
  'pedido rejeitado',
]);

const defaultRgpdTopics = [
  {
    title: 'Informacoes Gerais',
    body:
      'A empresa compromete-se a garantir a privacidade e a protecao dos dados pessoais de todos os utilizadores do website. Esta politica explica como recolhemos, utilizamos e protegemos os dados, em conformidade com o Regulamento Geral sobre a Protecao de Dados (RGPD).',
  },
  {
    title: 'Responsavel pelo Tratamento',
    body:
      'A entidade responsavel pela recolha e tratamento dos seus dados pessoais e:\n- Nome: Empresa\n- NIF: NIF\n- Sede: Morada da Empresa\n- Contacto: Email de Contacto da Empresa',
  },
  {
    title: 'Recolha e Finalidade dos Dados',
    body:
      'Recolhemos dados apenas quando necessario para as seguintes finalidades:\n- Formularios de contacto\n- Newsletter (mediante consentimento)\n- Cookies para melhoria da experiencia e analise estatistica',
  },
  {
    title: 'Direitos do Utilizador',
    body:
      'De acordo com o RGPD, o utilizador tem o direito de:\n1. Acesso aos dados guardados\n2. Retificacao de dados incorretos\n3. Esquecimento (eliminacao dos dados)\n4. Oposicao ao tratamento para marketing',
  },
  {
    title: 'Conservacao de Dados',
    body:
      'Os dados pessoais sao conservados apenas pelo periodo necessario para cumprir as finalidades descritas, ou durante o tempo exigido por obrigacoes legais.',
  },
];

const parseId = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const normalizeBoolean = (value) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return false;
};

const normalizeText = (value) => String(value ?? '').trim();

const normalizeEventKey = (value) => normalizeText(value).toLowerCase();

const normalizeBody = (value) => String(value ?? '').replace(/\r\n/g, '\n');

const ensureNotificationDefaults = async (transaction) => {
  const rows = await ConfigNotificacao.findAll({
    attributes: ['evento'],
    transaction,
  });
  const existingEvents = new Set(
    (rows || []).map((row) => normalizeEventKey(row?.evento)),
  );

  const validEvents = new Set(
    defaultNotificationRows.map((item) => normalizeEventKey(item.event)),
  );

  for (const existingEvent of existingEvents) {
    if (!validEvents.has(existingEvent)) {
      await ConfigNotificacao.destroy({
        where: { evento: { [Op.iLike]: existingEvent } },
        transaction,
      });
    }
  }

  for (const item of defaultNotificationRows) {
    const eventKey = normalizeEventKey(item.event);
    if (existingEvents.has(eventKey)) {
      continue;
    }

    await ConfigNotificacao.create(
      {
        evento: item.event,
        admin: item.admin,
        sll: item.sll,
        tl: item.tl,
        consultor: item.consultor,
        email: item.email,
        web_app: item.webApp,
      },
      { transaction },
    );

    existingEvents.add(eventKey);
  }

  for (const item of defaultNotificationRows) {
    const eventKey = normalizeEventKey(item.event);
    if (!existingEvents.has(eventKey)) {
      continue;
    }

    if (item.event === 'Pedido aprovado' || item.event === 'Pedido rejeitado') {
      await ConfigNotificacao.update(
        {
          admin: item.admin,
          sll: item.sll,
          tl: item.tl,
          consultor: item.consultor,
          email: item.email,
          web_app: item.webApp,
        },
        {
          where: { evento: { [Op.iLike]: item.event } },
          transaction,
        },
      );
    }
  }
};

const ensureRgpdDefaults = async (transaction) => {
  const total = await RgpdTopico.count({ transaction });

  if (total > 0) {
    return;
  }

  for (const [index, item] of defaultRgpdTopics.entries()) {
    await RgpdTopico.create(
      {
        titulo: item.title,
        corpo: item.body,
        ordem: index + 1,
      },
      { transaction },
    );
  }
};

const ensureDefaults = async (transaction) => {
  await ensureNotificationDefaults(transaction);
  await ensureRgpdDefaults(transaction);
};

const listNotificationSettings = async (transaction) => {
  const rows = await ConfigNotificacao.findAll({
    order: [['nconfig', 'ASC']],
    transaction,
  });

  return (rows || []).map((row) => ({
    id: Number(row?.nconfig),
    event: row?.evento || '',
    admin: Boolean(row?.admin),
    sll: Boolean(row?.sll),
    tl: Boolean(row?.tl),
    consultor: Boolean(row?.consultor),
    email: Boolean(row?.email),
    hasEmail: EMAIL_SUPPORTED_EVENTS.has(normalizeEventKey(row?.evento)),
    webApp: Boolean(row?.web_app),
  }));
};

const listRgpdTopics = async (transaction) => {
  const rows = await RgpdTopico.findAll({
    order: [['ordem', 'ASC'], ['nrgpd', 'ASC']],
    transaction,
  });

  return (rows || []).map((row) => ({
    id: Number(row?.nrgpd),
    title: row?.titulo || '',
    body: row?.corpo || '',
    order: Number(row?.ordem) || 0,
  }));
};

const normalizeNotificationUpdate = (row) => {
  const id = parseId(row?.id);
  if (!id) {
    return null;
  }

  return {
    id,
    admin: normalizeBoolean(row?.admin),
    sll: normalizeBoolean(row?.sll),
    tl: normalizeBoolean(row?.tl),
    consultor: normalizeBoolean(row?.consultor),
    email: normalizeBoolean(row?.email),
    webApp: normalizeBoolean(row?.webApp ?? row?.web_app),
  };
};

const normalizeRgpdUpdate = (row) => {
  const id = parseId(row?.id);
  if (!id) {
    return null;
  }

  return {
    id,
    body: normalizeBody(row?.body),
  };
};

export const adminGeneralManagementModel = {
  async listGeneralManagement() {
    return sequelize.transaction(async (transaction) => {
      await ensureDefaults(transaction);

      const notifications = await listNotificationSettings(transaction);
      const rgpd = await listRgpdTopics(transaction);

      return { notifications, rgpd };
    });
  },

  async updateNotificationSettings(rows) {
    const updates = (Array.isArray(rows) ? rows : [])
      .map(normalizeNotificationUpdate)
      .filter(Boolean);

    return sequelize.transaction(async (transaction) => {
      await ensureDefaults(transaction);

      for (const update of updates) {
        await ConfigNotificacao.update(
          {
            admin: update.admin,
            sll: update.sll,
            tl: update.tl,
            consultor: update.consultor,
            email: update.email,
            web_app: update.webApp,
          },
          {
            where: { nconfig: update.id },
            transaction,
          },
        );
      }

      return listNotificationSettings(transaction);
    });
  },

  async updateRgpdTopics(rows) {
    const updates = (Array.isArray(rows) ? rows : [])
      .map(normalizeRgpdUpdate)
      .filter(Boolean);

    return sequelize.transaction(async (transaction) => {
      await ensureDefaults(transaction);

      for (const update of updates) {
        await RgpdTopico.update(
          { corpo: update.body },
          {
            where: { nrgpd: update.id },
            transaction,
          },
        );
      }

      return listRgpdTopics(transaction);
    });
  },
};
