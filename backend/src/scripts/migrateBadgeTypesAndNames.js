import 'dotenv/config';
import { Client } from 'pg';

const {
  DB_HOST = 'localhost',
  DB_PORT = '5432',
  DB_NAME = 'BD-PINT',
  DB_USER = 'postgres',
  DB_PASSWORD = 'postgres',
} = globalThis.process?.env ?? {};

const desiredTypes = [
  {
    ntipo: 1,
    tipo: 'Nível Júnior',
    keywords: ['junior'],
  },
  {
    ntipo: 2,
    tipo: 'Nível Intermédio',
    keywords: ['intermedio', 'interm'],
  },
  {
    ntipo: 3,
    tipo: 'Nível Sénior',
    keywords: ['senior'],
  },
  {
    ntipo: 4,
    tipo: 'Nível Especialista',
    keywords: ['especialista'],
  },
  {
    ntipo: 5,
    tipo: 'Nível Lider de Conhecimento',
    keywords: ['lider de conhecimento', 'lider'],
  },
];

const pointsByType = new Map([
  [1, 100],
  [2, 150],
  [3, 200],
  [4, 250],
  [5, 300],
]);

const normalizeForCompare = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const detectTypeId = (row) => {
  const levelSource = row.nivel || row.b_descricao || row.b_nome || '';
  const normalizedSource = normalizeForCompare(levelSource);

  for (const type of desiredTypes) {
    if (type.keywords.some((keyword) => normalizedSource.includes(keyword))) {
      return type.ntipo;
    }
  }

  return Number(row.ntipo) || 1;
};

const extractNameFromDescription = (description) => {
  const rawDescription = String(description || '').trim();
  if (!rawDescription.includes(' - ')) {
    return '';
  }

  return rawDescription.split(' - ')[0].trim();
};

const extractNameFromBadgeName = (badgeName) =>
  String(badgeName || '')
    .replace(/\s*-\s*.*/g, '')
    .replace(/\s*nivel\s+.*/i, '')
    .replace(/\s+/g, ' ')
    .trim();

const deriveSimpleBadgeName = (row) => {
  const fromArea = String(row.area || '').trim();
  if (fromArea) {
    return fromArea.slice(0, 25);
  }

  const fromDescription = extractNameFromDescription(row.b_descricao);
  if (fromDescription) {
    return fromDescription.slice(0, 25);
  }

  const fromBadgeName = extractNameFromBadgeName(row.b_nome);
  if (fromBadgeName) {
    return fromBadgeName.slice(0, 25);
  }

  return `Badge ${row.nbadge}`.slice(0, 25);
};

const buildSimpleDescription = (badgeName) => `Badge da area ${badgeName}.`;

const migrateBadgeTypesAndNames = async () => {
  const client = new Client({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
  });

  await client.connect();

  try {
    await client.query('BEGIN');

    for (const type of desiredTypes) {
      const existingById = await client.query(
        `
          SELECT ntipo
          FROM tipo
          WHERE ntipo = $1
          LIMIT 1
        `,
        [type.ntipo],
      );

      if (existingById.rowCount > 0) {
        continue;
      }

      await client.query(
        `
          INSERT INTO tipo (ntipo, tipo)
          OVERRIDING SYSTEM VALUE
          VALUES ($1, $2)
        `,
        [type.ntipo, `__tmp_tipo_${type.ntipo}__`],
      );
    }

    for (const type of desiredTypes) {
      await client.query(
        `
          UPDATE tipo
          SET tipo = $2
          WHERE ntipo = $1
        `,
        [type.ntipo, `__tmp_tipo_${type.ntipo}__`],
      );
    }

    await client.query(
      `
        UPDATE tipo
        SET tipo = CONCAT(tipo, ' (extra ', ntipo, ')')
        WHERE ntipo NOT IN (1, 2, 3, 4, 5)
          AND tipo IN (${desiredTypes.map((_, index) => `$${index + 1}`).join(', ')})
      `,
      desiredTypes.map((type) => type.tipo),
    );

    for (const type of desiredTypes) {
      await client.query(
        `
          UPDATE tipo
          SET tipo = $2
          WHERE ntipo = $1
        `,
        [type.ntipo, type.tipo],
      );
    }

    await client.query(
      `
        SELECT setval(
          pg_get_serial_sequence('tipo', 'ntipo'),
          COALESCE((SELECT MAX(ntipo) FROM tipo), 1),
          true
        )
      `,
    );

    const badges = await client.query(
      `
        SELECT DISTINCT ON (b.nbadge)
          b.nbadge,
          b.b_nome,
          b.b_descricao,
          b.ntipo,
          a.area,
          n.nivel
        FROM badge AS b
        LEFT JOIN nivel_contem_b AS ncb
          ON ncb.nbadge = b.nbadge
        LEFT JOIN nivel AS n
          ON n.nnivel = ncb.nnivel
        LEFT JOIN area AS a
          ON a.narea = n.narea
        ORDER BY b.nbadge ASC, n.nnivel ASC NULLS LAST
      `,
    );

    for (const row of badges.rows) {
      const badgeName = deriveSimpleBadgeName(row);
      const badgeDescription = buildSimpleDescription(badgeName);
      const ntipo = detectTypeId(row);
      const pontos = pointsByType.get(ntipo) || 0;

      await client.query(
        `
          UPDATE badge
          SET b_nome = $1,
              b_descricao = $2,
              ntipo = $3,
              pontos = $4
          WHERE nbadge = $5
        `,
        [badgeName, badgeDescription, ntipo, pontos, Number(row.nbadge)],
      );
    }

    await client.query('COMMIT');

    const tipoRows = await client.query('SELECT ntipo, tipo FROM tipo ORDER BY ntipo ASC');
    const badgeSummary = await client.query(
      `
        SELECT ntipo, COUNT(*)::int AS total
        FROM badge
        GROUP BY ntipo
        ORDER BY ntipo ASC
      `,
    );

    console.log('Tipos atualizados (ordem final):');
    for (const row of tipoRows.rows) {
      console.log(`  ${row.ntipo} - ${row.tipo}`);
    }

    console.log('\nBadges por ntipo:');
    for (const row of badgeSummary.rows) {
      console.log(`  ntipo ${row.ntipo}: ${row.total}`);
    }
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
};

migrateBadgeTypesAndNames().catch((error) => {
  console.error('Falha ao migrar tipo/badge:', error);
  globalThis.process?.exit(1);
});
