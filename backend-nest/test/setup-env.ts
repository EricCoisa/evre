import 'dotenv/config';

process.env.NODE_ENV = 'test';
process.env.APP_NAME = 'test-app';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_EXPIRATION = '1h';
process.env.JWT_REFRESH_EXPIRATION = '7d';
process.env.CRYPTO_SECRET = 'test-crypto-secret-32-chars-abcd';
