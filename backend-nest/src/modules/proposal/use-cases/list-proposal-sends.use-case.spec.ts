import { Test } from '@nestjs/testing';
import { PrismaService } from 'src/prisma/prisma.service';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import { ListProposalSendsUseCase } from './list-proposal-sends.use-case';
import { FindOneProposalUseCase } from './find-one.use-case';

const admin: AuthenticatedUser = {
  id: 'admin-1',
  email: 'admin@example.com',
  roleId: 'role-admin',
  roleName: 'ADMIN',
};

const mockPrisma = {
  proposalSend: { findMany: vi.fn() },
};
const mockFindOne = { execute: vi.fn() };

describe('ListProposalSendsUseCase', () => {
  let useCase: ListProposalSendsUseCase;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ListProposalSendsUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: FindOneProposalUseCase, useValue: mockFindOne },
      ],
    }).compile();
    useCase = module.get(ListProposalSendsUseCase);

    vi.clearAllMocks();
    mockFindOne.execute.mockResolvedValue({ id: 'proposal-1' });
    mockPrisma.proposalSend.findMany.mockResolvedValue([]);
  });

  it('checa acesso via FindOneProposalUseCase antes de listar', async () => {
    await useCase.execute('proposal-1', admin);

    expect(mockFindOne.execute).toHaveBeenCalledWith('proposal-1', admin);
  });

  it('busca por todas as versões da proposta, mais recente primeiro', async () => {
    await useCase.execute('proposal-1', admin);

    expect(mockPrisma.proposalSend.findMany).toHaveBeenCalledWith({
      where: { version: { proposalId: 'proposal-1' } },
      orderBy: { createdAt: 'desc' },
    });
  });
});
