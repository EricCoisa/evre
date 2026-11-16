import { Client } from 'pg';
import { getPayload } from 'payload';
import config from '../payload.config';

async function resetDatabaseSchema() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('Variável de ambiente DATABASE_URL não definida.');
  }

  // Obtém o nome do schema do Payload dinamicamente a partir da configuração
  const resolvedConfig = await config;
  const dbConfig = resolvedConfig.db as { schemaName?: string } | undefined;
  const schemaName = dbConfig?.schemaName || 'payload';

  console.log(`🧹 Resetando o schema "${schemaName}" no PostgreSQL de forma agnóstica...`);

  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  try {
    await client.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE;`);
    await client.query(`CREATE SCHEMA "${schemaName}";`);
    console.log(`✓ Schema "${schemaName}" resetado com sucesso (todas as tabelas e enums foram recriados).`);
  } finally {
    await client.end();
  }
}

async function runSeed() {
  // 1. Reseta o schema do Payload agnosticamente (sem depender de nomes de tabelas ou colunas)
  await resetDatabaseSchema();

  // 2. Inicializa o Payload CMS — o Drizzle cria todas as tabelas e o onInit executa os seeds configurados
  console.log('🌱 Inicializando o Payload CMS e executando seeds automáticos...');
  await getPayload({ config });

  console.log('✅ Banco resetado e seed concluído com sucesso!');
  process.exit(0);
}

runSeed().catch((err) => {
  console.error('❌ Falha ao rodar reset e seed:', err);
  process.exit(1);
});
