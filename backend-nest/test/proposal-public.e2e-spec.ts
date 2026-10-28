import request from 'supertest';
import { type INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { createTestApp } from './helpers';

const ADMIN_EMAIL = 'admin@example.com';

describe('Proposal public page (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let proposalId: string;
  let versionId: string;
  let publicToken: string;
  let acceptProposalId: string;
  let acceptPublicToken: string;

  beforeAll(async () => {
    prisma = new PrismaClient();
    const admin = await prisma.user.findUnique({
      where: { email: ADMIN_EMAIL },
    });
    if (!admin) throw new Error('Admin user not found — seed may have failed');

    const proposal = await prisma.proposal.create({
      data: { name: 'E2E Public Proposal', ownerId: admin.id },
    });
    proposalId = proposal.id;
    publicToken = randomUUID();

    const version = await prisma.proposalVersion.create({
      data: {
        proposalId: proposal.id,
        version: 1,
        layout: { v: 1, blocks: [] },
        currency: 'BRL',
        recurrence: 'ONE_TIME',
        publicToken,
        publishedAt: new Date(),
      },
    });
    versionId = version.id;

    const acceptProposal = await prisma.proposal.create({
      data: { name: 'E2E Acceptance Proposal', ownerId: admin.id },
    });
    acceptProposalId = acceptProposal.id;
    acceptPublicToken = randomUUID();
    await prisma.proposalVersion.create({
      data: {
        proposalId: acceptProposal.id,
        version: 1,
        layout: { v: 1, blocks: [] },
        currency: 'BRL',
        recurrence: 'ONE_TIME',
        publicToken: acceptPublicToken,
        publishedAt: new Date(),
      },
    });

    app = await createTestApp();
  });

  afterAll(async () => {
    await prisma.proposalOpenEvent.deleteMany({ where: { versionId } });
    await prisma.proposal.delete({ where: { id: proposalId } });
    await prisma.proposal.delete({ where: { id: acceptProposalId } });
    await prisma.$disconnect();
    await app.close();
  });

  it('GET /proposals/public/:token responde sem cookie de sessão nem Authorization', async () => {
    const res = await request(app.getHttpServer()).get(
      `/api/v1/proposals/public/${publicToken}`,
    );

    expect(res.status).toBe(200);
    expect(res.body.proposalName).toBe('E2E Public Proposal');
    expect(res.body).not.toHaveProperty('ownerId');
    expect(res.body).not.toHaveProperty('id');
  });

  it('GET /proposal (rota interna) continua exigindo auth', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/proposal');
    expect(res.status).toBe(401);
  });

  it('dois POST de aceite em sequência gravam uma decisão só — o segundo não responde erro', async () => {
    const body = { name: 'Cliente E2E', email: 'cliente.e2e@example.com' };

    const first = await request(app.getHttpServer())
      .post(`/api/v1/proposals/public/${acceptPublicToken}/accept`)
      .send(body);
    expect(first.status).toBe(200);
    expect(first.body.alreadyAccepted).toBe(false);

    const second = await request(app.getHttpServer())
      .post(`/api/v1/proposals/public/${acceptPublicToken}/accept`)
      .send(body);
    expect(second.status).toBe(200);
    expect(second.body.alreadyAccepted).toBe(true);
    expect(second.body.acceptedAt).toBe(first.body.acceptedAt);

    const proposal = await prisma.proposal.findUnique({
      where: { id: acceptProposalId },
    });
    expect(proposal?.status).toBe('ACCEPTED');
  });
});
