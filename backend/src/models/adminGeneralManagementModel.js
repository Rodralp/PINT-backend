import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const defaultNotificationRows = [
  {
    event: 'Novo registo',
    admin: true,
    sll: true,
    tl: false,
    consultor: false,
    email: false,
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
    admin: false,
    sll: false,
    tl: false,
    consultor: true,
    email: true,
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

const defaultGeneralSettings = [
  {
    key: 'Tema padrao',
    value: 'Claro',
    options: ['Claro', 'Escuro', 'Automatico'],
  },
  {
    key: 'Idioma padrao',
    value: 'Portugues (PT)',
    options: ['Portugues (PT)', 'English (EN)', 'Espanol (ES)'],
  },
  {
    key: 'Notificacoes email',
    value: 'Ativo',
    options: ['Ativo', 'Inativo'],
  },
  {
    key: 'Notificacoes in-app',
    value: 'Ativo',
    options: ['Ativo', 'Inativo'],
  },
  {
    key: 'Resumo semanal',
    value: 'Inativo',
    options: ['Ativo', 'Inativo'],
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

const normalizeOptions = (value) => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }

  return [];
};

const ensureNotificationDefaults = async (transaction) => {
  const rows = await sequelize.query(
    'SELECT evento FROM config_notificacao',
    { type: QueryTypes.SELECT, transaction },
  );
  const existingEvents = new Set(
    (rows || []).map((row) => normalizeEventKey(row?.evento)),
  );

  const validEvents = new Set(
    defaultNotificationRows.map((item) => normalizeEventKey(item.event)),
  );

  for (const existingEvent of existingEvents) {
    if (!validEvents.has(existingEvent)) {
      await sequelize.query(
        'DELETE FROM config_notificacao WHERE LOWER(evento) = :evento',
        { replacements: { evento: existingEvent }, type: QueryTypes.DELETE, transaction },
      );
    }
  }

  for (const item of defaultNotificationRows) {
    const eventKey = normalizeEventKey(item.event);
    if (existingEvents.has(eventKey)) {
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

const ensureRgpdDefaults = async (transaction) => {
  const [row] = await sequelize.query(
    'SELECT COUNT(*) AS total FROM rgpd_topico',
    { type: QueryTypes.SELECT, transaction },
  );

  if (Number(row?.total) > 0) {
    return;
  }

  for (const [index, item] of defaultRgpdTopics.entries()) {
    await sequelize.query(
      `
        INSERT INTO rgpd_topico (titulo, corpo, ordem)
        VALUES (:title, :body, :order)
      `,
      {
        replacements: {
          title: item.title,
          body: item.body,
          order: index + 1,
        },
        type: QueryTypes.INSERT,
        transaction,
      },
    );
  }
};

const ensureGeneralDefaults = async (transaction) => {
  for (const item of defaultGeneralSettings) {
    await sequelize.query(
      `
        INSERT INTO config_geral (chave, valor, opcoes)
        VALUES (:key, :value, ARRAY[:options]::TEXT[])
        ON CONFLICT (chave) DO NOTHING
      `,
      {
        replacements: {
          key: item.key,
          value: item.value,
          options: item.options,
        },
        type: QueryTypes.INSERT,
        transaction,
      },
    );
  }
};

const ensureDefaults = async (transaction) => {
  await ensureNotificationDefaults(transaction);
  await ensureRgpdDefaults(transaction);
  await ensureGeneralDefaults(transaction);
};

const listNotificationSettings = async (transaction) => {
  const rows = await sequelize.query(
    `
      SELECT nconfig, evento, admin, sll, tl, consultor, email, web_app
      FROM config_notificacao
      ORDER BY nconfig ASC
    `,
    { type: QueryTypes.SELECT, transaction },
  );

  return (rows || []).map((row) => ({
    id: Number(row?.nconfig),
    event: row?.evento || '',
    admin: Boolean(row?.admin),
    sll: Boolean(row?.sll),
    tl: Boolean(row?.tl),
    consultor: Boolean(row?.consultor),
    email: Boolean(row?.email),
    webApp: Boolean(row?.web_app),
  }));
};

const listRgpdTopics = async (transaction) => {
  const rows = await sequelize.query(
    `
      SELECT nrgpd, titulo, corpo, ordem
      FROM rgpd_topico
      ORDER BY ordem ASC, nrgpd ASC
    `,
    { type: QueryTypes.SELECT, transaction },
  );

  return (rows || []).map((row) => ({
    id: Number(row?.nrgpd),
    title: row?.titulo || '',
    body: row?.corpo || '',
    order: Number(row?.ordem) || 0,
  }));
};

const listGeneralSettings = async (transaction) => {
  const rows = await sequelize.query(
    `
      SELECT nconfig, chave, valor, opcoes
      FROM config_geral
      ORDER BY nconfig ASC
    `,
    { type: QueryTypes.SELECT, transaction },
  );

  return (rows || []).map((row) => ({
    id: Number(row?.nconfig),
    key: row?.chave || '',
    value: row?.valor || '',
    options: normalizeOptions(row?.opcoes),
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

const normalizeGeneralUpdate = (row) => {
  const id = parseId(row?.id);
  if (!id) {
    return null;
  }

  return {
    id,
    value: normalizeText(row?.value),
  };
};

export const adminGeneralManagementModel = {
  async listGeneralManagement() {
    return sequelize.transaction(async (transaction) => {
      await ensureDefaults(transaction);

      const notifications = await listNotificationSettings(transaction);
      const rgpd = await listRgpdTopics(transaction);
      const settings = await listGeneralSettings(transaction);

      return { notifications, rgpd, settings };
    });
  },

  async updateNotificationSettings(rows) {
    const updates = (Array.isArray(rows) ? rows : [])
      .map(normalizeNotificationUpdate)
      .filter(Boolean);

    return sequelize.transaction(async (transaction) => {
      await ensureDefaults(transaction);

      for (const update of updates) {
        await sequelize.query(
          `
            UPDATE config_notificacao
            SET admin = :admin,
                sll = :sll,
                tl = :tl,
                consultor = :consultor,
                email = :email,
                web_app = :webApp
            WHERE nconfig = :id
          `,
          {
            replacements: update,
            type: QueryTypes.UPDATE,
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
        await sequelize.query(
          `
            UPDATE rgpd_topico
            SET corpo = :body
            WHERE nrgpd = :id
          `,
          {
            replacements: update,
            type: QueryTypes.UPDATE,
            transaction,
          },
        );
      }

      return listRgpdTopics(transaction);
    });
  },

  async updateGeneralSettings(rows) {
    const updates = (Array.isArray(rows) ? rows : [])
      .map(normalizeGeneralUpdate)
      .filter(Boolean);

    return sequelize.transaction(async (transaction) => {
      await ensureDefaults(transaction);

      for (const update of updates) {
        await sequelize.query(
          `
            UPDATE config_geral
            SET valor = :value
            WHERE nconfig = :id
          `,
          {
            replacements: update,
            type: QueryTypes.UPDATE,
            transaction,
          },
        );
      }

      return listGeneralSettings(transaction);
    });
  },
};
