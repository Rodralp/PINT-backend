import { Account } from '../models/sql/Account.js';
import { Reminder } from '../models/sql/Reminder.js';
import { QueryTypes } from 'sequelize';
import { sequelize } from './database.js';

const defaultAccounts = [
  {
    nome: 'Joao Gomes',
    email: 'joaogomes1234@softinsa.pt',
    senha: '12345678',
    role: 'consultor',
    status: 'ativo',
  },
  {
    nome: 'Maria Santos',
    email: 'maria.santos@softinsa.pt',
    senha: '12345678',
    role: 'talent-manager',
    status: 'ativo',
  },
  {
    nome: 'Pedro Mendes',
    email: 'pedro.mendes@softinsa.pt',
    senha: '12345678',
    role: 'service-line-leader',
    status: 'ativo',
  },
  {
    nome: 'Ana Costa',
    email: 'ana.costa@softinsa.pt',
    senha: '12345678',
    role: 'admin-gestor',
    status: 'ativo',
  },
  {
    nome: 'Testes',
    email: 'testes@softinsa.pt',
    senha: '12345678',
    role: 'consultor;talent-manager;service-line-leader;admin-gestor',
    status: 'ativo',
  },
];

const defaultReminders = [
  {
    title: 'Conferir requisitos enviados.',
    description: 'Rever todos os requisitos do novo projeto',
    date: '2025-12-07',
    color: 'green',
  },
  {
    title: 'Badge C++ Mastery expira em 30 dias.',
    description: 'Renovar certificacao antes do prazo',
    date: '2025-11-29',
    color: 'yellow',
  },
  {
    title: 'Meta de 15 badges ate ao fim do mes.',
    description: 'Completar badges restantes para atingir a meta',
    date: '2025-11-27',
    color: 'blue',
  },
  {
    title: 'Reuniao de equipa trimestral.',
    description: 'Preparar apresentacao dos resultados',
    date: '2026-01-15',
    color: 'purple',
  },
];

const defaultLearningPath = {
  name: 'Jornada Tecnica',
  description: 'Percurso tecnico base para Service Lines da plataforma.',
};

const defaultServiceLines = [
  {
    name: 'Hybrid Cloud',
    description: 'Foco em arquitetura cloud hibrida, operacao e escalabilidade.',
    areas: ['LowCode (Outsystems)'],
  },
  {
    name: 'Application Operations',
    description: 'Foco em operacoes de aplicacoes, DevSecOps e automacao.',
    areas: ['DevSecOps & IT Automation'],
  },
  {
    name: 'Sourcing & Talent Management',
    description: 'Foco em recrutamento, gestao de talento e desenvolvimento de carreiras.',
    areas: ['Sourcing & Talent Management'],
  },
];

const defaultLevelNames = [
  'Nivel Junior',
  'Nivel Intermedio',
  'Nivel Senior',
  'Nivel Especialista',
  'Nivel Lider de Conhecimento',
];

const defaultBadgeTypes = [
  {
    ntipo: 1,
    tipo: 'Nível Júnior',
    matchers: ['junior'],
    pontos: 100,
    levelKey: 'badge_level_junior',
  },
  {
    ntipo: 2,
    tipo: 'Nível Intermédio',
    matchers: ['intermedio', 'interm'],
    pontos: 150,
    levelKey: 'badge_level_intermediate',
  },
  {
    ntipo: 3,
    tipo: 'Nível Sénior',
    matchers: ['senior'],
    pontos: 200,
    levelKey: 'badge_level_senior',
  },
  {
    ntipo: 4,
    tipo: 'Nível Especialista',
    matchers: ['especialista'],
    pontos: 250,
    levelKey: 'badge_level_specialist',
  },
  {
    ntipo: 5,
    tipo: 'Nível Lider de Conhecimento',
    matchers: ['lider de conhecimento', 'lider'],
    pontos: 300,
    levelKey: 'badge_level_knowledge_lead',
  },
];

const getLevelLabel = (rawLevelName) => {
  const raw = String(rawLevelName || '').trim();
  if (!raw.includes(' - ')) {
    return raw || 'Nivel';
  }

  return raw.split(' - ').slice(1).join(' - ').trim() || 'Nivel';
};

const normalizeForCompare = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const buildSimpleBadgeName = (areaName) =>
  String(areaName || 'Badge')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 50) || 'Badge';

const buildSimpleBadgeDescription = (areaName) =>
  `Badge da area ${buildSimpleBadgeName(areaName)}.`;

const resolveBadgeTypeIdFromLevel = (rawLevelName, badgeTypeIdByIndex) => {
  const normalizedLevelLabel = normalizeForCompare(getLevelLabel(rawLevelName));

  for (const badgeType of defaultBadgeTypes) {
    const matchesBadgeType = badgeType.matchers.some((matcher) =>
      normalizedLevelLabel.includes(matcher),
    );

    if (matchesBadgeType) {
      return badgeTypeIdByIndex.get(badgeType.ntipo) ?? badgeType.ntipo;
    }
  }

  return badgeTypeIdByIndex.get(1) ?? 1;
};

const buildBadgePointsByTypeId = (badgeTypeIdByIndex) => new Map([
  [badgeTypeIdByIndex.get(1) ?? 1, 100],
  [badgeTypeIdByIndex.get(2) ?? 2, 150],
  [badgeTypeIdByIndex.get(3) ?? 3, 200],
  [badgeTypeIdByIndex.get(4) ?? 4, 250],
  [badgeTypeIdByIndex.get(5) ?? 5, 300],
]);

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

const isServiceLineLeader = (account) => normalizeRoles(account.role).includes('service-line-leader');

const getOrCreateLearningPathId = async (transaction) => {
  const [existing] = await sequelize.query(
    `
      SELECT nlpath
      FROM learning_path
      WHERE LOWER(lpath) = LOWER(:name)
      LIMIT 1
    `,
    {
      replacements: { name: defaultLearningPath.name },
      type: QueryTypes.SELECT,
      transaction,
    },
  );

  if (existing?.nlpath) {
    return Number(existing.nlpath);
  }

  const [inserted] = await sequelize.query(
    `
      INSERT INTO learning_path (lpath, lp_desc)
      VALUES (:name, :description)
      RETURNING nlpath
    `,
    {
      replacements: {
        name: defaultLearningPath.name,
        description: defaultLearningPath.description,
      },
      type: QueryTypes.SELECT,
      transaction,
    },
  );

  return Number(inserted.nlpath);
};

const ensureServiceLinesAndAreas = async (learningPathId, transaction) => {
  const serviceLineIds = [];

  for (const serviceLine of defaultServiceLines) {
    const [existingServiceLine] = await sequelize.query(
      `
        SELECT nsline
        FROM service_line
        WHERE LOWER(sline) = LOWER(:name)
        LIMIT 1
      `,
      {
        replacements: { name: serviceLine.name },
        type: QueryTypes.SELECT,
        transaction,
      },
    );

    let serviceLineId = existingServiceLine?.nsline ? Number(existingServiceLine.nsline) : null;

    if (!serviceLineId) {
      const [insertedServiceLine] = await sequelize.query(
        `
          INSERT INTO service_line (sline, sl_desc, nlpath)
          VALUES (:name, :description, :learningPathId)
          RETURNING nsline
        `,
        {
          replacements: {
            name: serviceLine.name,
            description: serviceLine.description,
            learningPathId,
          },
          type: QueryTypes.SELECT,
          transaction,
        },
      );

      serviceLineId = Number(insertedServiceLine.nsline);
    }

    serviceLineIds.push(serviceLineId);

    for (const areaName of serviceLine.areas) {
      const [existingArea] = await sequelize.query(
        `
          SELECT narea
          FROM area
          WHERE nsline = :serviceLineId
            AND LOWER(area) = LOWER(:areaName)
          LIMIT 1
        `,
        {
          replacements: { serviceLineId, areaName },
          type: QueryTypes.SELECT,
          transaction,
        },
      );

      let areaId = existingArea?.narea ? Number(existingArea.narea) : null;

      if (!areaId) {
        const [insertedArea] = await sequelize.query(
          `
            INSERT INTO area (area, a_desc, nsline)
            VALUES (:areaName, :areaDescription, :serviceLineId)
            RETURNING narea
          `,
          {
            replacements: {
              areaName,
              areaDescription: `${areaName} - percurso de desenvolvimento`,
              serviceLineId,
            },
            type: QueryTypes.SELECT,
            transaction,
          },
        );

        areaId = Number(insertedArea.narea);
      }

      for (const levelName of defaultLevelNames) {
        const scopedLevelName = `${areaName} - ${levelName}`;

        await sequelize.query(
          `
            INSERT INTO nivel (nivel, narea)
            SELECT :scopedLevelName, :areaId
            WHERE NOT EXISTS (
              SELECT 1
              FROM nivel
              WHERE narea = :areaId
                AND LOWER(nivel) = LOWER(:scopedLevelName)
            )
          `,
          {
            replacements: { scopedLevelName, areaId },
            type: QueryTypes.INSERT,
            transaction,
          },
        );
      }
    }
  }

  return serviceLineIds;
};

const ensureUtilizadorForAccounts = async (accounts, transaction) => {
  const utilizadorByAccountId = new Map();

  for (const account of accounts) {
    const [existingUser] = await sequelize.query(
      `
        SELECT nutilizador
        FROM utilizador
        WHERE LOWER(email) = LOWER(:email)
        LIMIT 1
      `,
      {
        replacements: { email: account.email },
        type: QueryTypes.SELECT,
        transaction,
      },
    );

    if (existingUser?.nutilizador) {
      utilizadorByAccountId.set(account.id, Number(existingUser.nutilizador));
      continue;
    }

    const [insertedUser] = await sequelize.query(
      `
        INSERT INTO utilizador (nome, email, data_registo, permissoes)
        VALUES (:nome, :email, CURRENT_DATE, :permissoes)
        RETURNING nutilizador
      `,
      {
        replacements: {
          nome: account.nome,
          email: account.email,
          permissoes: normalizeRoles(account.role || 'consultor').join(',')
        },
        type: QueryTypes.SELECT,
        transaction,
      },
    );

    utilizadorByAccountId.set(account.id, Number(insertedUser.nutilizador));
  }

  return utilizadorByAccountId;
};

const assignServiceLineToEachLeader = async (accounts, serviceLineIds, transaction) => {
  const leaderAccounts = accounts.filter(isServiceLineLeader);
  const globalAccessUserIds = new Set();

  if (leaderAccounts.length === 0 || serviceLineIds.length === 0) {
    return;
  }

  for (let index = 0; index < leaderAccounts.length; index += 1) {
    const account = leaderAccounts[index];
    const utilizadorId = account.id;

    if (!utilizadorId) {
      continue;
    }

    const serviceLineId = serviceLineIds[index % serviceLineIds.length];

    await sequelize.query(
      'DELETE FROM sll_leader_sl WHERE nutilizador = :utilizadorId',
      {
        replacements: { utilizadorId },
        type: QueryTypes.DELETE,
        transaction,
      },
    );

    if (globalAccessUserIds.has(Number(utilizadorId))) {
      for (const currentServiceLineId of serviceLineIds) {
        await sequelize.query(
          `
            INSERT INTO sll_leader_sl (nutilizador, nsline)
            VALUES (:utilizadorId, :serviceLineId)
          `,
          {
            replacements: { utilizadorId, serviceLineId: currentServiceLineId },
            type: QueryTypes.INSERT,
            transaction,
          },
        );
      }
      continue;
    }

    await sequelize.query(
      `
        INSERT INTO sll_leader_sl (nutilizador, nsline)
        VALUES (:utilizadorId, :serviceLineId)
      `,
      {
        replacements: { utilizadorId, serviceLineId },
        type: QueryTypes.INSERT,
        transaction,
      },
    );
  }
};

const ensureBadgeTypes = async (transaction) => {
  const badgeTypeIdByIndex = new Map();

  for (const badgeType of defaultBadgeTypes) {
    const [existingById] = await sequelize.query(
      `
        SELECT ntipo
        FROM tipo
        WHERE ntipo = :ntipo
        LIMIT 1
      `,
      {
        replacements: { ntipo: badgeType.ntipo },
        type: QueryTypes.SELECT,
        transaction,
      },
    );

    if (!existingById?.ntipo) {
      await sequelize.query(
        `
          INSERT INTO tipo (ntipo, tipo)
          OVERRIDING SYSTEM VALUE
          VALUES (:ntipo, :tmpTipo)
        `,
        {
          replacements: {
            ntipo: badgeType.ntipo,
            tmpTipo: `__tmp_tipo_${badgeType.ntipo}__`,
          },
          type: QueryTypes.INSERT,
          transaction,
        },
      );
    }

    badgeTypeIdByIndex.set(badgeType.ntipo, badgeType.ntipo);
  }

  for (const badgeType of defaultBadgeTypes) {
    await sequelize.query(
      `
        UPDATE tipo
        SET tipo = :tmpTipo
        WHERE ntipo = :ntipo
      `,
      {
        replacements: {
          ntipo: badgeType.ntipo,
          tmpTipo: `__tmp_tipo_${badgeType.ntipo}__`,
        },
        type: QueryTypes.UPDATE,
        transaction,
      },
    );
  }

  await sequelize.query(
    `
      UPDATE tipo
      SET tipo = CONCAT(tipo, ' (extra ', ntipo, ')')
      WHERE ntipo NOT IN (${defaultBadgeTypes.map((type) => type.ntipo).join(', ')})
        AND tipo IN (:targetNames)
    `,
    {
      replacements: {
        targetNames: defaultBadgeTypes.map((type) => type.tipo),
      },
      type: QueryTypes.UPDATE,
      transaction,
    },
  );

  for (const badgeType of defaultBadgeTypes) {
    await sequelize.query(
      `
        UPDATE tipo
        SET tipo = :tipo, pontos = :pontos, level_key = :levelKey
        WHERE ntipo = :ntipo
      `,
      {
        replacements: { ntipo: badgeType.ntipo, tipo: badgeType.tipo, pontos: badgeType.pontos, levelKey: badgeType.levelKey },
        type: QueryTypes.UPDATE,
        transaction,
      },
    );
  }

  await sequelize.query(
    `
      SELECT setval(
        pg_get_serial_sequence('tipo', 'ntipo'),
        COALESCE((SELECT MAX(ntipo) FROM tipo), 1),
        true
      )
    `,
    {
      type: QueryTypes.SELECT,
      transaction,
    },
  );

  return badgeTypeIdByIndex;
};

const ensureEstadosAndMockData = async (accounts, transaction) => {
  // Estados conforme especificação:
  // 1=rejeitado, 2=pendente-tm, 3=pendente-sll, 4=aprovado
  const estados = ['rejeitado', 'pendente-tm', 'pendente-sll', 'aprovado'];
  const estadoIds = {};
  const badgeTypeIdByIndex = await ensureBadgeTypes(transaction);
  const badgePointsByTypeId = buildBadgePointsByTypeId(badgeTypeIdByIndex);
  
  for (const st of estados) {
    const [existing] = await sequelize.query(
      `SELECT nestado FROM estado WHERE estado = :st LIMIT 1`,
      { replacements: { st }, type: QueryTypes.SELECT, transaction }
    );
    if (!existing) {
      const [inserted] = await sequelize.query(
        `INSERT INTO estado (estado) VALUES (:st) RETURNING nestado`,
        { replacements: { st }, type: QueryTypes.SELECT, transaction }
      );
      estadoIds[st] = Number(inserted.nestado);
    } else {
      estadoIds[st] = Number(existing.nestado);
    }
  }

  const niveis = await sequelize.query(`
    SELECT n.nnivel, n.nivel, a.area, sl.sline, lp.nlpath, sl.nsline, a.narea
    FROM nivel n
    JOIN area a ON a.narea = n.narea
    JOIN service_line sl ON sl.nsline = a.nsline
    JOIN learning_path lp ON lp.nlpath = sl.nlpath
    ORDER BY n.nnivel ASC
  `, { type: QueryTypes.SELECT, transaction });

  const badgesByNivel = {};

  for (const n of niveis) {
    const [existingCb] = await sequelize.query(`
      SELECT nbadge FROM nivel_contem_b WHERE nnivel = :nnivel LIMIT 1
    `, { replacements: { nnivel: n.nnivel }, type: QueryTypes.SELECT, transaction });

    const b_nome = buildSimpleBadgeName(n.area);
    const b_descricao = buildSimpleBadgeDescription(n.area);
    const ntipo = resolveBadgeTypeIdFromLevel(n.nivel, badgeTypeIdByIndex);
    const pontos = badgePointsByTypeId.get(ntipo) ?? 0;
    let nbadge = null;

    if (!existingCb) {
      const [insertedB] = await sequelize.query(`
          INSERT INTO badge (b_nome, b_descricao, ntipo, pontos)
          VALUES (:b_nome, :b_descricao, :ntipo, :pontos)
          RETURNING nbadge
        `, { replacements: { b_nome, b_descricao, ntipo, pontos }, type: QueryTypes.SELECT, transaction });
      nbadge = Number(insertedB.nbadge);

      await sequelize.query(`INSERT INTO nivel_contem_b (nnivel, nbadge) VALUES (:nnivel, :nbadge)`,
        { replacements: { nnivel: n.nnivel, nbadge }, type: QueryTypes.INSERT, transaction });
      
      await sequelize.query(`INSERT INTO b_pertence_a (narea, nbadge) VALUES (:narea, :nbadge)`, { replacements: { narea: n.narea, nbadge }, type: QueryTypes.INSERT, transaction });
      await sequelize.query(`INSERT INTO b_pertence_sl (nsline, nbadge) VALUES (:nsline, :nbadge)`, { replacements: { nsline: n.nsline, nbadge }, type: QueryTypes.INSERT, transaction });
      await sequelize.query(`INSERT INTO b_pertence_lp (nlpath, nbadge) VALUES (:nlpath, :nbadge)`, { replacements: { nlpath: n.nlpath, nbadge }, type: QueryTypes.INSERT, transaction });
    } else {
      nbadge = Number(existingCb.nbadge);
    }

    await sequelize.query(
      `
        UPDATE badge
        SET b_nome = :b_nome,
            b_descricao = :b_descricao,
            ntipo = :ntipo,
            pontos = :pontos
        WHERE nbadge = :nbadge
      `,
      {
        replacements: { nbadge, b_nome, b_descricao, ntipo, pontos },
        type: QueryTypes.UPDATE,
        transaction,
      },
    );

    badgesByNivel[n.nnivel] = nbadge;
  }

  for (const [typeId, points] of badgePointsByTypeId.entries()) {
    await sequelize.query(
      `
        UPDATE badge
        SET pontos = :points
        WHERE ntipo = :typeId
      `,
      {
        replacements: { points, typeId },
        type: QueryTypes.UPDATE,
        transaction,
      },
    );
  }

  const consultorAccounts = accounts.filter((account) =>
    normalizeRoles(account.role).includes('consultor'),
  );

  for (const account of consultorAccounts) {
    const utilizadorId = account.id;
    if (!utilizadorId) {
      continue;
    }

    for (const n of niveis) {
      const nbadge = badgesByNivel[n.nnivel];
      if (!nbadge) {
        continue;
      }

      const [hasCb] = await sequelize.query(
        `
          SELECT 1
          FROM c_obtem_b
          WHERE nutilizador = :utilizadorId
            AND nbadge = :nbadge
          LIMIT 1
        `,
        {
          replacements: { utilizadorId, nbadge },
          type: QueryTypes.SELECT,
          transaction,
        },
      );
      const [hasPed] = await sequelize.query(
        `
          SELECT 1
          FROM pedidos
          WHERE nutilizador = :utilizadorId
            AND nbadge = :nbadge
          LIMIT 1
        `,
        {
          replacements: { utilizadorId, nbadge },
          type: QueryTypes.SELECT,
          transaction,
        },
      );

      if (hasCb || hasPed) {
        continue;
      }

      const seed = (Number(utilizadorId) + Number(n.nnivel)) % 7;
      if (seed === 0 || seed === 4) {
        continue;
      }

      // seed 1 = criar pedido APROVADO (estado 4) com badge obtida
      if (seed === 1) {
        const [createdPedido] = await sequelize.query(
          `
            INSERT INTO pedidos (nutilizador, nbadge, estado, data_submissao, data_limite)
            VALUES (:utilizadorId, :nbadge, :estadoId, CURRENT_DATE, CURRENT_DATE + INTERVAL '3 months')
            RETURNING npedido
          `,
          {
            replacements: { utilizadorId, nbadge, estadoId: estadoIds.aprovado },
            type: QueryTypes.SELECT,
            transaction,
          },
        );

        await sequelize.query(
          `
            INSERT INTO c_obtem_b (nutilizador, nbadge, npedido, pontos_obtidos, data_obtencao)
            VALUES (:utilizadorId, :nbadge, :npedido, 100, CURRENT_DATE)
          `,
          {
            replacements: { utilizadorId, nbadge, npedido: createdPedido.npedido },
            type: QueryTypes.INSERT,
            transaction,
          },
        );
        continue;
      }

      // seed 2 = pendente-tm (estado 2), seed 3 = rejeitado (estado 1), seed 6 = pendente-sll (estado 3)
      const estadoId = seed === 2
        ? estadoIds['pendente-tm']
        : seed === 3
          ? estadoIds.rejeitado
          : seed === 6
            ? estadoIds['pendente-sll']
            : estadoIds['pendente-tm'];

      await sequelize.query(
        `
          INSERT INTO pedidos (nutilizador, nbadge, estado, data_submissao, data_limite)
          VALUES (:utilizadorId, :nbadge, :estadoId, CURRENT_DATE, CURRENT_DATE + INTERVAL '3 months')
        `,
        {
          replacements: { utilizadorId, nbadge, estadoId },
          type: QueryTypes.INSERT,
          transaction,
        },
      );
    }
  }
};

const seedServiceLineData = async () => {
  const transaction = await sequelize.transaction();

  try {
    const accounts = await Account.findAll({
      attributes: ['id', 'nome', 'email', 'role'],
      order: [['id', 'ASC']],
      transaction,
    });

    if (accounts.length === 0) {
      await transaction.commit();
      return;
    }

    const utilizadorByAccountId = await ensureUtilizadorForAccounts(accounts, transaction);
    const learningPathId = await getOrCreateLearningPathId(transaction);
    const serviceLineIds = await ensureServiceLinesAndAreas(learningPathId, transaction);
    await assignServiceLineToEachLeader(accounts, serviceLineIds, transaction);
    
    await ensureEstadosAndMockData(accounts, transaction);
    await seedBadgeRequirements(transaction);

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const badgeRequirementsByLevel = {
  junior: [
    { requisito: 'Completar formacao basica', r_descricao: 'Demonstrar conhecimentos fundamentais da area.' },
    { requisito: 'Participar em 3 projetos', r_descricao: 'Contribuir ativamente em pelo menos 3 projetos da equipa.' },
    { requisito: 'Avaliacao do mentor', r_descricao: 'Obter avaliacao positiva do mentor atribuido.' },
  ],
  intermedio: [
    { requisito: 'Implementar funcionalidade complexa', r_descricao: 'Desenvolver e entregar uma funcionalidade com complexidade intermedia.' },
    { requisito: 'Rever codigo de 2 colegas', r_descricao: 'Realizar code review em pelo menos 2 projetos de colegas.' },
    { requisito: 'Documentar processo tecnico', r_descricao: 'Criar documentacao tecnica para um modulo ou servico.' },
  ],
  senior: [
    { requisito: 'Liderar sprint tecnico', r_descricao: 'Assumir responsabilidade tecnica num sprint completo.' },
    { requisito: 'Mentorar 2 consultores', r_descricao: 'Acompanhar e orientar 2 consultores junior/intermedios.' },
    { requisito: 'Apresentar session tech talk', r_descricao: 'Realizar uma apresentacao tecnica para a equipa.' },
  ],
  especialista: [
    { requisito: 'Definir arquitetura de solucao', r_descricao: 'Projetar e documentar a arquitetura de uma solucao enterprise.' },
    { requisito: 'Resolver incidente critico', r_descricao: 'Diagnosticar e resolver um incidente de producao de alta criticidade.' },
    { requisito: 'Publicar artigo tecnico interno', r_descricao: 'Escrever e publicar um artigo tecnico na plataforma interna.' },
  ],
  lider: [
    { requisito: 'Criar learning path', r_descricao: 'Desenvolver um percurso de aprendizagem para a equipa.' },
    { requisito: 'Avaliar 5 consultores', r_descricao: 'Realizar avaliacoes tecnicas formais a pelo menos 5 consultores.' },
    { requisito: 'Propor melhoria de processo', r_descricao: 'Identificar e propor pelo menos 2 melhorias nos processos da equipa.' },
  ],
};

const resolveRequirementLevelKey = (levelTitle) => {
  const normalized = String(levelTitle || '').trim().toLowerCase();
  if (normalized.includes('junior')) return 'junior';
  if (normalized.includes('intermedio') || normalized.includes('interm')) return 'intermedio';
  if (normalized.includes('senior')) return 'senior';
  if (normalized.includes('especialista')) return 'especialista';
  if (normalized.includes('lider')) return 'lider';
  return 'intermedio';
};

const seedBadgeRequirements = async (transaction) => {
  const badges = await sequelize.query(
    `
      SELECT b.nbadge, b.b_nome, n.nivel
      FROM badge b
      LEFT JOIN nivel_contem_b ncb ON ncb.nbadge = b.nbadge
      LEFT JOIN nivel n ON n.nnivel = ncb.nnivel
      ORDER BY b.nbadge ASC
    `,
    { type: QueryTypes.SELECT, transaction },
  );

  for (const badge of badges) {
    const [existingCount] = await sequelize.query(
      `SELECT COUNT(*)::int AS cnt FROM requisitos WHERE nbadge = :nbadge`,
      { replacements: { nbadge: badge.nbadge }, type: QueryTypes.SELECT, transaction },
    );

    if (existingCount?.cnt > 0) continue;

    const levelKey = resolveRequirementLevelKey(badge.nivel);
    const requirements = badgeRequirementsByLevel[levelKey] || badgeRequirementsByLevel.intermedio;

    for (const req of requirements) {
      await sequelize.query(
        `INSERT INTO requisitos (requisito, r_descricao, nbadge) VALUES (:requisito, :r_descricao, :nbadge)`,
        { replacements: { requisito: req.requisito, r_descricao: req.r_descricao, nbadge: badge.nbadge }, type: QueryTypes.INSERT, transaction },
      );
    }
  }
};

export const seedDatabase = async () => {
  const [accountsCount, remindersCount] = await Promise.all([Account.count(), Reminder.count()]);

  if (accountsCount === 0) {
    await Account.bulkCreate(defaultAccounts);
  }

  const orderedAccounts = await Account.findAll({ order: [['id', 'ASC']] });
  const defaultConsultorAccount = orderedAccounts.find((account) =>
    String(account.role || 'consultor')
      .split(';')
      .map((role) => role.trim().toLowerCase())
      .includes('consultor')
  ) || orderedAccounts[0] || null;

  if (defaultConsultorAccount) {
    await Reminder.update(
      { accountId: defaultConsultorAccount.id },
      { where: { accountId: null } },
    );
  }

  if (remindersCount === 0 && defaultConsultorAccount) {
    await Reminder.bulkCreate(
      defaultReminders.map((reminder) => ({
        ...reminder,
        accountId: defaultConsultorAccount.id,
      })),
    );
  }

  await seedServiceLineData();
};
