import 'dotenv/config';

process.env.NODE_ENV = 'test';
process.env.APP_NAME = 'test-app';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_EXPIRATION = '1h';
process.env.JWT_REFRESH_EXPIRATION = '7d';

// O DATABASE_URL de teste é definido pelo vitest-global-setup.ts
// via variável de ambiente injetada pelo Testcontainers.
