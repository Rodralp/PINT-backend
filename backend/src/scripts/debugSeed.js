import 'dotenv/config';
import { connectToDatabase, sequelize } from '../config/database.js';
import { QueryTypes } from 'sequelize';

await connectToDatabase();

console.log('=== DEBUG SEED ===\n');

// Verificar badges e niveis
const badges = await sequelize.query('SELECT nbadge, b_nome FROM badge', { type: QueryTypes.SELECT });
console.log(`Badges criadas: ${badges.length}`);

const niveis = await sequelize.query('SELECT nnivel, nivel, narea FROM nivel', { type: QueryTypes.SELECT });
console.log(`Niveis criados: ${niveis.length}`);

const nivelContemB = await sequelize.query('SELECT nbadge, nnivel FROM nivel_contem_b', { type: QueryTypes.SELECT });
console.log(`Nivel_contem_b: ${nivelContemB.length}`);

// Verificar consultores
const consultores = await sequelize.query(
  "SELECT nutilizador, nome, permissoes FROM utilizador WHERE LOWER(permissoes) LIKE '%consultor%'",
  { type: QueryTypes.SELECT }
);
console.log(`\nConsultores encontrados: ${consultores.length}`);
consultores.forEach(c => console.log(`  - ${c.nome} (#${c.nutilizador})`));

// Verificar estados
const estados = await sequelize.query('SELECT nestado, estado FROM estado', { type: QueryTypes.SELECT });
console.log(`\nEstados: ${estados.length}`);
estados.forEach(e => console.log(`  - ${e.estado} (#${e.nestado})`));

// Testar criar um pedido manualmente
if (consultores.length > 0 && badges.length > 0) {
  const consultor = consultores[0];
  const badge = badges[0];
  const estadoAprovado = estados.find(e => e.estado === 'aprovado');
  
  console.log(`\n=== TENTAR CRIAR PEDIDO TESTE ===`);
  console.log(`Consultor: #${consultor.nutilizador}, Badge: #${badge.nbadge}`);
  
  try {
    const [pedido] = await sequelize.query(
      `INSERT INTO pedidos (nutilizador, nbadge, estado, data_submissao)
       VALUES (:nutilizador, :nbadge, :estado, CURRENT_DATE)
       RETURNING npedido`,
      {
        replacements: {
          nutilizador: consultor.nutilizador,
          nbadge: badge.nbadge,
          estado: estadoAprovado?.nestado || 1
        },
        type: QueryTypes.SELECT
      }
    );
    console.log(`Pedido criado: #${pedido.npedido}`);
    
    await sequelize.query(
      `INSERT INTO c_obtem_b (nutilizador, nbadge, npedido, pontos_obtidos, data_obtencao)
       VALUES (:nutilizador, :nbadge, :npedido, 100, CURRENT_DATE)`,
      {
        replacements: {
          nutilizador: consultor.nutilizador,
          nbadge: badge.nbadge,
          npedido: pedido.npedido
        },
        type: QueryTypes.INSERT
      }
    );
    console.log('C_obtem_b criado com sucesso!');
  } catch (error) {
    console.error('ERRO:', error.message);
  }
}

await sequelize.close();
