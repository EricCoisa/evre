import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { execSync } from 'child_process';

let container: StartedPostgreSqlContainer;

export async function setup() {
  // Provisiona um container PostgreSQL isolado para testes E2E
  container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('test_db')
    .withUsername('test_user')
    .withPassword('test_password')
    .start();

  const databaseUrl = container.getConnectionUri();

  // Expõe a URL para os testes
  process.env.DATABASE_URL = databaseUrl;

  // Executa as migrations do Prisma no banco de teste
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  });

  // Popula o banco com dados padrão (usuários, rotas, configurações)
  execSync('npx tsx prisma/seed.ts', {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  });
}

export async function teardown() {
  await container?.stop();
}
