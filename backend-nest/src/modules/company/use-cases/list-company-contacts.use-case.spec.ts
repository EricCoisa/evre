import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ListCompanyContactsUseCase } from './list-company-contacts.use-case';
import { PrismaService } from '../../../prisma/prisma.service';
import { ResourceAccessService } from 'src/common/infrastructure/resource-access/resource-access.service';
import type { AuthenticatedUser } from 'src/common/types/auth.types';

const user: AuthenticatedUser = {
  id: 'user-1',
  email: 'user@example.com',
  roleId: 'role-user',
  roleName: 'USER',
};

const mockPrisma = {
  companyContact: { findMany: vi.fn() },
};
const mockResourceAccess = { assertCanRead: vi.fn() };

describe('ListCompanyContactsUseCase', () => {
  let useCase: ListCompanyContactsUseCase;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListCompanyContactsUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ResourceAccessService, useValue: mockResourceAccess },
      ],
    }).compile();
    useCase = module.get<ListCompanyContactsUseCase>(ListCompanyContactsUseCase);
  });

  afterEach(() => vi.clearAllMocks());

  it('nega antes de consultar o Prisma quando o usuário não tem Membership na empresa', async () => {
    mockResourceAccess.assertCanRead.mockRejectedValue(
      new NotFoundException('mensagem'),
    );

    await expect(useCase.execute('company-1', user)).rejects.toThrow(
      NotFoundException,
    );
    expect(mockPrisma.companyContact.findMany).not.toHaveBeenCalled();
  });

  it('lista só os contatos ativos da empresa com dados do MessagingContact', async () => {
    mockResourceAccess.assertCanRead.mockResolvedValue(undefined);
    mockPrisma.companyContact.findMany.mockResolvedValue([]);

    await useCase.execute('company-1', user);

    expect(mockResourceAccess.assertCanRead).toHaveBeenCalledWith(user, {
      companyId: 'company-1',
    });
    expect(mockPrisma.companyContact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: 'company-1', archivedAt: null },
        include: { messagingContact: true },
      }),
    );
  });
});
