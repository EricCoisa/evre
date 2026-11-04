import request from 'supertest';
import { type INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { createTestApp } from './helpers';

describe('Artifact public view (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let artifactId: string;
  const publicToken = `e2e-${randomUUID()}`;

  beforeAll(async () => {
    prisma = new PrismaClient();
    const artifact = await prisma.artifact.create({
      data: {
        kind: 'FILE',
        storageKey: `app/artifacts/${randomUUID()}.html`,
        fileName: 'demo.html',
        contentType: 'text/html',
        files: [{ path: 'demo.html', contentType: 'text/html', sizeBytes: 10 }],
        sizeBytes: 10,
        published: false,
        publicToken,
      },
    });
    artifactId = artifact.id;

    app = await createTestApp();
  });

  afterAll(async () => {
    await prisma.artifact.delete({ where: { id: artifactId } });
    await prisma.$disconnect();
    await app.close();
  });

  it('não publicado → 404', async () => {
    const res = await request(app.getHttpServer()).get(
      `/api/v1/artifacts/public/${publicToken}`,
    );
    expect(res.status).toBe(404);
  });

  it('publicado → 302 com Location, sem cookie nem Authorization', async () => {
    await prisma.artifact.update({
      where: { id: artifactId },
      data: { published: true },
    });

    const res = await request(app.getHttpServer()).get(
      `/api/v1/artifacts/public/${publicToken}`,
    );
    expect(res.status).toBe(302);
    expect(res.headers.location).toBeTruthy();
  });

  it('arquivado, mesmo publicado → 404 (revoga de fato, sem depender de ACL de bucket)', async () => {
    await prisma.artifact.update({
      where: { id: artifactId },
      data: { archivedAt: new Date() },
    });

    const res = await request(app.getHttpServer()).get(
      `/api/v1/artifacts/public/${publicToken}`,
    );
    expect(res.status).toBe(404);
  });

  it('token inexistente → 404', async () => {
    const res = await request(app.getHttpServer()).get(
      '/api/v1/artifacts/public/token-que-nao-existe',
    );
    expect(res.status).toBe(404);
  });
});
