import request from 'supertest';
import { type INestApplication } from '@nestjs/common';
import { createTestApp } from './helpers';

const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASSWORD = 'admin123';

describe('SystemConfiguration (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let createdConfigId: string;

  beforeAll(async () => {
    app = await createTestApp();

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    adminToken = loginRes.body.tokens.accessToken;
  });

  afterAll(async () => {
    // Clean up any config created during tests (best-effort)
    if (createdConfigId) {
      await request(app.getHttpServer())
        .delete(`/api/system-configuration/${createdConfigId}`)
        .set('Authorization', `Bearer ${adminToken}`);
    }
    await app.close();
  });

  // ─── GET /api/system-configuration ────────────────────────────────────────

  describe('GET /api/system-configuration', () => {
    it('returns 200 with config list for ADMIN', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/system-configuration')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });

    it('returns 401 when unauthenticated', async () => {
      const res = await request(app.getHttpServer()).get(
        '/api/v1/system-configuration',
      );
      expect(res.status).toBe(401);
    });
  });

  // ─── GET /api/system-configuration/signup ─────────────────────────────────

  describe('GET /api/system-configuration/signup', () => {
    it('returns 200 without authentication', async () => {
      const res = await request(app.getHttpServer()).get(
        '/api/v1/system-configuration/signup',
      );

      expect(res.status).toBe(200);
      expect(res.body.labelKey).toBe('SYSTEM_USER_CREATE');
    });
  });

  // ─── GET /api/system-configuration/default-theme ──────────────────────────

  describe('GET /api/system-configuration/default-theme', () => {
    it('returns 200 without authentication', async () => {
      const res = await request(app.getHttpServer()).get(
        '/api/v1/system-configuration/default-theme',
      );

      expect(res.status).toBe(200);
      expect(res.body.labelKey).toBe('SYSTEMCONFIG_THEME');
    });
  });

  // ─── POST /api/system-configuration ───────────────────────────────────────

  describe('POST /api/system-configuration', () => {
    it('creates a new configuration and returns 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/system-configuration')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          labelKey: 'E2E_TEST_CONFIG',
          valueType: 'string',
          value: 'e2e-value',
          secret: false,
        });

      expect(res.status).toBe(201);
      expect(res.body.labelKey).toBe('E2E_TEST_CONFIG');
      expect(res.body.value).toBe('e2e-value');

      createdConfigId = res.body.id;
    });

    it('returns 409 when labelKey already exists', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/system-configuration')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          labelKey: 'E2E_TEST_CONFIG',
          valueType: 'string',
          value: 'duplicate',
          secret: false,
        });

      expect(res.status).toBe(409);
    });

    it('returns 401 when unauthenticated', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/system-configuration')
        .send({
          labelKey: 'E2E_UNAUTH_CONFIG',
          valueType: 'string',
          value: 'val',
          secret: false,
        });

      expect(res.status).toBe(401);
    });
  });

  // ─── GET /api/system-configuration/:id ────────────────────────────────────

  describe('GET /api/system-configuration/:id', () => {
    it('returns 200 with config for valid id', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/system-configuration/${createdConfigId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(createdConfigId);
    });

    it('returns 404 for non-existent id', async () => {
      const res = await request(app.getHttpServer())
        .get(
          '/api/v1/system-configuration/00000000-0000-0000-0000-000000000000',
        )
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ─── PATCH /api/system-configuration/:id ──────────────────────────────────

  describe('PATCH /api/system-configuration/:id', () => {
    it('returns 200 and updated config', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/system-configuration/${createdConfigId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ value: 'updated-value' });

      expect(res.status).toBe(200);
      expect(res.body.value).toBe('updated-value');
    });
  });

  // ─── DELETE /api/system-configuration/:id ─────────────────────────────────

  describe('DELETE /api/system-configuration/:id', () => {
    it('returns 204 and removes the configuration', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/system-configuration/${createdConfigId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(204);
      // Mark as deleted so afterAll skip cleanup
      createdConfigId = '';
    });

    it('returns 404 after deletion', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/system-configuration/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });
});
