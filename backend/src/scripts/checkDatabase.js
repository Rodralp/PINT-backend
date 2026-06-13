import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;

const {
  DB_HOST = 'localhost',
  DB_PORT = '5432',
  DB_NAME = 'BD-PINT',
  DB_USER = 'postgres',
  DB_PASSWORD = 'postgres',
} = process.env;

const client = new Client({
  host: DB_HOST,
  port: Number(DB_PORT),
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
});

await client.connect();

console.log(`=== CONECTADO À BASE DE DADOS: ${DB_NAME} ===\n`);

// Listar tabelas
const tables = await client.query(`
  SELECT table_name 
  FROM information_schema.tables 
  WHERE table_schema = 'public'
  ORDER BY table_name
`);

console.log('=== TABELAS ===');
if (tables.rows.length === 0) {
  console.log('(Nenhuma tabela encontrada)');
} else {
  tables.rows.forEach(r => console.log(`  - ${r.table_name}`));
}

console.log('\n=== CONTAGEM DE REGISTOS ===');

try {
  const utilizadores = await client.query('SELECT COUNT(*) as count FROM utilizador');
  console.log(`  Utilizadores: ${utilizadores.rows[0].count}`);
} catch (e) {
  console.log(`  Utilizadores: ERRO - ${e.message}`);
}

try {
  const badges = await client.query('SELECT COUNT(*) as count FROM badge');
  console.log(`  Badges: ${badges.rows[0].count}`);
} catch (e) {
  console.log(`  Badges: ERRO - ${e.message}`);
}

try {
  const sl = await client.query('SELECT COUNT(*) as count FROM service_line');
  console.log(`  Service Lines: ${sl.rows[0].count}`);
} catch (e) {
  console.log(`  Service Lines: ERRO - ${e.message}`);
}

try {
  const areas = await client.query('SELECT COUNT(*) as count FROM area');
  console.log(`  Areas: ${areas.rows[0].count}`);
} catch (e) {
  console.log(`  Areas: ERRO - ${e.message}`);
}

try {
  const lp = await client.query('SELECT COUNT(*) as count FROM learning_path');
  console.log(`  Learning Paths: ${lp.rows[0].count}`);
} catch (e) {
  console.log(`  Learning Paths: ERRO - ${e.message}`);
}

try {
  const pedidos = await client.query('SELECT COUNT(*) as count FROM pedidos');
  console.log(`  Pedidos: ${pedidos.rows[0].count}`);
} catch (e) {
  console.log(`  Pedidos: ERRO - ${e.message}`);
}

try {
  const cob = await client.query('SELECT COUNT(*) as count FROM c_obtem_b');
  console.log(`  C_obtem_b: ${cob.rows[0].count}`);
} catch (e) {
  console.log(`  C_obtem_b: ERRO - ${e.message}`);
}

console.log('\n=== CONTAS CRIADAS ===');
try {
  const contas = await client.query('SELECT nutilizador, nome, email, permissoes FROM utilizador');
  contas.rows.forEach(c => {
    console.log(`  #${c.nutilizador}: ${c.nome} (${c.email}) - ${c.permissoes}`);
  });
} catch (e) {
  console.log(`  ERRO: ${e.message}`);
}

await client.end();
