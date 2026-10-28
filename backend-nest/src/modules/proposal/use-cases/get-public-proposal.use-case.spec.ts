import { Test } from '@nestjs/testing';
import { GoneException, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import { GetPublicProposalUseCase } from './get-public-proposal.use-case';

const mockPrisma = {
  proposalVersion: { findUnique: vi.fn() },
};

const mockI18n = { t: vi.fn((key: string) => key) };

function version(overrides: Record<string, unknown> = {}) {
  return {
    publicToken: 'tok123',
    revokedAt: null as Date | null,
    validUntil: null as Date | null,
    layout: { v: 1, blocks: [] },
    totalCents: 150000,
    currency: 'BRL',
    recurrence: 'MONTHLY',
    termDays: 30,
    includedItems: ['Item A'],
    optionalItems: [],
    acceptedAt: null as Date | null,
    proposal: {
      ownerId: 'owner-1',
      name: 'Proposta confidencial',
      company: { name: 'ACME' },
    },
    ...overrides,
  };
}

describe('GetPublicProposalUseCase', () => {
  let useCase: GetPublicProposalUseCase;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        GetPublicProposalUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: I18nService, useValue: mockI18n },
      ],
    }).compile();
    useCase = module.get(GetPublicProposalUseCase);
    vi.clearAllMocks();
  });

  it('token inexistente lança NotFoundException', async () => {
    mockPrisma.proposalVersion.findUnique.mockResolvedValueOnce(null);

    await expect(useCase.execute('nao-existe')).rejects.toThrow(
      NotFoundException,
    );
    expect(mockI18n.t).toHaveBeenCalledWith('proposal.public.not_found');
  });

  it('versão revogada lança GoneException com motivo REVOKED', async () => {
    mockPrisma.proposalVersion.findUnique.mockResolvedValueOnce(
      version({ revokedAt: new Date('2026-01-01T00:00:00Z') }),
    );

    const error: unknown = await useCase.execute('tok123').catch((e) => e);

    expect(error).toBeInstanceOf(GoneException);
    expect(error).toMatchObject({
      status: 410,
      response: { errors: { reason: 'REVOKED' } },
    });
  });

  it('validUntil no passado lança GoneException com motivo EXPIRED', async () => {
    mockPrisma.proposalVersion.findUnique.mockResolvedValue(
      version({ validUntil: new Date(Date.now() - 10000) }),
    );

    await expect(useCase.execute('tok123')).rejects.toMatchObject({
      status: 410,
      response: { errors: { reason: 'EXPIRED' } },
    });
  });

  it('versão ativa devolve só o payload público — sem ownerId, id nem nota interna', async () => {
    mockPrisma.proposalVersion.findUnique.mockResolvedValueOnce(version());

    const result = await useCase.execute('tok123');

    expect(result).toEqual({
      proposalName: 'Proposta confidencial',
      companyName: 'ACME',
      layout: { v: 1, blocks: [] },
      acceptedAt: null,
      envelope: {
        totalCents: 150000,
        currency: 'BRL',
        recurrence: 'MONTHLY',
        termDays: 30,
        validUntil: null,
        includedItems: ['Item A'],
        optionalItems: [],
      },
    });
    expect(Object.keys(result)).toEqual([
      'proposalName',
      'companyName',
      'layout',
      'acceptedAt',
      'envelope',
    ]);
    expect(JSON.stringify(result)).not.toContain('owner-1');
    expect(JSON.stringify(result)).not.toContain('ownerId');
    expect(JSON.stringify(result)).not.toContain('lostReason');
  });
});
