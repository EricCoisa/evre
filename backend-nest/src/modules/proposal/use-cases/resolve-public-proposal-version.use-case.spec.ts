import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import { ResolvePublicProposalVersionUseCase } from './resolve-public-proposal-version.use-case';

const mockPrisma = {
  proposalVersion: { findUnique: vi.fn() },
};

const mockI18n = { t: vi.fn((key: string) => key) };

describe('ResolvePublicProposalVersionUseCase', () => {
  let useCase: ResolvePublicProposalVersionUseCase;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ResolvePublicProposalVersionUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: I18nService, useValue: mockI18n },
      ],
    }).compile();
    useCase = module.get(ResolvePublicProposalVersionUseCase);
    vi.clearAllMocks();
  });

  it('token existente devolve o id da versão', async () => {
    mockPrisma.proposalVersion.findUnique.mockResolvedValueOnce({
      id: 'version-1',
    });

    const result = await useCase.execute('tok123');

    expect(mockPrisma.proposalVersion.findUnique).toHaveBeenCalledWith({
      where: { publicToken: 'tok123' },
      select: { id: true },
    });
    expect(result).toEqual({ id: 'version-1' });
  });

  it('token inexistente lança NotFoundException — mesma chave i18n de GetPublicProposalUseCase', async () => {
    mockPrisma.proposalVersion.findUnique.mockResolvedValueOnce(null);

    await expect(useCase.execute('nao-existe')).rejects.toThrow(
      NotFoundException,
    );
    expect(mockI18n.t).toHaveBeenCalledWith('proposal.public.not_found');
  });
});
