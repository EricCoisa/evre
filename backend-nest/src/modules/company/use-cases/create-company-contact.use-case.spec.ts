import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CreateCompanyContactUseCase } from './create-company-contact.use-case';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { ResourceAccessService } from 'src/common/infrastructure/resource-access/resource-access.service';
import type { AuthenticatedUser } from 'src/common/types/auth.types';

const user: AuthenticatedUser = {
  id: 'user-1',
  email: 'user@example.com',
  roleId: 'role-user',
  roleName: 'USER',
};

const mockPrisma = {
  contact: { create: vi.fn() },
};
const mockLogging = { create: vi.fn() };
const mockResourceAccess = { assertCanRead: vi.fn() };

describe('CreateCompanyContactUseCase', () => {
  let useCase: CreateCompanyContactUseCase;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateCompanyContactUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LoggingService, useValue: mockLogging },
        { provide: ResourceAccessService, useValue: mockResourceAccess },
      ],
    }).compile();
    useCase = module.get<CreateCompanyContactUseCase>(
      CreateCompanyContactUseCase,
    );
  });

  afterEach(() => vi.clearAllMocks());

  it('nega antes de escrever quem não tem Membership na empresa', async () => {
    mockResourceAccess.assertCanRead.mockRejectedValue(
      new NotFoundException('mensagem'),
    );

    await expect(
      useCase.execute('company-1', { name: 'Fulano' } as never, user),
    ).rejects.toThrow(NotFoundException);
    expect(mockPrisma.contact.create).not.toHaveBeenCalled();
  });

  it('cria o contato vinculado à empresa e registra no audit trail', async () => {
    mockResourceAccess.assertCanRead.mockResolvedValue(undefined);
    mockPrisma.contact.create.mockResolvedValue({
      id: 'contact-1',
      name: 'Fulano',
    });

    await useCase.execute('company-1', { name: 'Fulano' } as never, user);

    expect(mockPrisma.contact.create).toHaveBeenCalledWith({
      data: { name: 'Fulano', companyId: 'company-1' },
    });
    expect(mockLogging.create).toHaveBeenCalledWith(
      expect.objectContaining({ module: 'COMPANY' }),
      user.id,
    );
  });
});
