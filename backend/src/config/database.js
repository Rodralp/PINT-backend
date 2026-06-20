import 'dotenv/config';
import { Sequelize } from 'sequelize';

const {
  DB_HOST = 'localhost',
  DB_PORT = '5432',
  DB_NAME = 'BD-PINT',
  DB_USER = 'postgres',
  DB_PASSWORD = 'postgres',
  DB_LOGGING = 'false',
} = globalThis.process?.env ?? {};

const shouldLogSql = DB_LOGGING === 'true';

const isProduction = DB_HOST !== 'localhost';

export const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
  host: DB_HOST,
  port: Number(DB_PORT),
  dialect: 'postgres',
  logging: shouldLogSql ? console.log : false,
  dialectOptions: isProduction ? {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  } : {},
});

export const connectToDatabase = async () => {
  await sequelize.authenticate();
};

export const setupExtraTables = async () => {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS badge_expiracao_log (
      nlog_expiracao INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      nbadge INTEGER NOT NULL REFERENCES badge(nbadge) ON DELETE CASCADE,
      data_expiracao DATE NOT NULL,
      data_processamento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      pedidos_rejeitados INTEGER DEFAULT 0,
      nivel_desativado BOOLEAN DEFAULT FALSE,
      CONSTRAINT unique_badge_expiracao UNIQUE (nbadge, data_expiracao)
    );
  `);

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS badge_imagem (
      nbadge INTEGER PRIMARY KEY REFERENCES badge(nbadge) ON DELETE CASCADE,
      mime_type VARCHAR(50) NOT NULL DEFAULT 'image/png',
      dados BYTEA NOT NULL,
      criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS utilizador_imagem (
      nutilizador INTEGER PRIMARY KEY REFERENCES utilizador(nutilizador) ON DELETE CASCADE,
      mime_type VARCHAR(50) NOT NULL DEFAULT 'image/png',
      dados BYTEA NOT NULL,
      criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  try {
    await sequelize.query(`
      INSERT INTO badge_imagem (nbadge, mime_type, dados, criado_em, atualizado_em)
      SELECT
        b.nbadge,
        COALESCE(
          SUBSTRING(b.imagem FROM '^data:([^;]+);') ,
          'image/png'
        ) AS mime_type,
        DECODE(
          SUBSTRING(b.imagem FROM '^data:[^;]+;base64,(.+)$'),
          'base64'
        ) AS dados,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      FROM badge AS b
      WHERE b.imagem IS NOT NULL
        AND b.imagem LIKE 'data:%;base64,%'
        AND NOT EXISTS (
          SELECT 1 FROM badge_imagem bi WHERE bi.nbadge = b.nbadge
        );
    `);
  } catch {
    // Badge image migration skipped — no images or malformed data
  }

  try {
    await sequelize.query(`ALTER TABLE utilizador ADD COLUMN IF NOT EXISTS localizacao VARCHAR(255);`);
  } catch {
    // Column already exists
  }

  try {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS vitrine (
        nutilizador INTEGER NOT NULL REFERENCES utilizador(nutilizador) ON DELETE CASCADE,
        nbadge INTEGER NOT NULL REFERENCES badge(nbadge) ON DELETE CASCADE,
        ordem INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (nutilizador, nbadge)
      );
    `);
  } catch {
    // vitrine table already exists
  }

  try {
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_vitrine_nutilizador ON vitrine(nutilizador);`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_pedidos_nutilizador ON pedidos(nutilizador);`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_pedidos_nbadge ON pedidos(nbadge);`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON pedidos(estado);`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_c_obtem_b_nutilizador ON c_obtem_b(nutilizador);`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_c_obtem_b_nbadge ON c_obtem_b(nbadge);`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_c_obtem_b_npedido ON c_obtem_b(npedido);`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_evidencias_npedido ON evidencias(npedido);`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_evidencias_nreq ON evidencias(nreq);`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_requisitos_nbadge ON requisitos(nbadge);`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_nivel_contem_b_nbadge ON nivel_contem_b(nbadge);`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_b_pertence_sl_nbadge ON b_pertence_sl(nbadge);`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_b_pertence_sl_nsline ON b_pertence_sl(nsline);`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_b_pertence_a_nbadge ON b_pertence_a(nbadge);`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_b_pertence_a_narea ON b_pertence_a(narea);`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_b_pertence_lp_nbadge ON b_pertence_lp(nbadge);`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_area_nsline ON area(nsline);`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_nivel_narea ON nivel(narea);`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_service_line_nlpath ON service_line(nlpath);`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_notificacao_nutilizador ON notificacao(nutilizador);`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_lembrete_nutilizador ON lembrete(nutilizador);`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_preferencias_nutilizador ON preferencias(nutilizador);`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_motivo_npedido ON motivo(npedido);`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_logs_nutilizador ON logs(nutilizador);`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_sll_leader_sl_nsline ON sll_leader_sl(nsline);`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_badge_trigger_nbadge ON badge_trigger(nbadge);`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_cnu_nutilizador ON config_notificacao_utilizador(nutilizador);`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_u_pertence_equipa_nutilizador ON u_pertence_equipa(nutilizador);`);
  } catch {
    // Indexes already exist
  }
};

export const syncDatabase = async () => {
  console.log('Database sync skipped - using existing schema');
};
