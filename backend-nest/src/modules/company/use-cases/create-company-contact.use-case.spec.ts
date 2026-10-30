import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CreateCompanyContactUseCase } from './create-company-contact.use-case';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { ResourceAccessService } from 'src/common/infrastructure/resource-access/resource-access.service';
import { CreateContactUseCase } from '../../messaging/use-cases/create-contact.use-case';
import type { AuthenticatedUser } from 'src/common/types/auth.types';

const user: AuthenticatedUser = {
  id: 'user-1',
  email: 'user@example.com',
  roleId: 'role-user',
  roleName: 'USER',
};

const mockPrisma = {
  messagingContact: { findUniqueOrThrow: vi.fn() },
  companyContact: { create: vi.fn() },
};
const mockLogging = { create: vi.fn() };
const mockResourceAccess = { assertCanRead: vi.fn() };
const mockCreateMessagingContact = { execute: vi.fn() };

describe('CreateCompanyContactUseCase', () => {
  let useCase: CreateCompanyContactUseCase;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateCompanyContactUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LoggingService, useValue: mockLogging },
        { provide: ResourceAccessService, useValue: mockResourceAccess },
        { provide: CreateContactUseCase, useValue: mockCreateMessagingContact },
      ],
    }).compile();
    useCase = module.get<CreateCompanyContactUseCase>(CreateCompanyContactUseCase);
  });

  afterEach(() => vi.clearAllMocks());

  it('nega antes de escrever quem não tem Membership na empresa', async () => {
    mockResourceAccess.assertCanRead.mockRejectedValue(new NotFoundException('mensagem'));

    await expect(
      useCase.execute('company-1', { phone: '5511999990000' } as never, user),
    ).rejects.toThrow(NotFoundException);
    expect(mockCreateMessagingContact.execute).not.toHaveBeenCalled();
    expect(mockPrisma.companyContact.create).not.toHaveBeenCalled();
  });

  it('cria o MC pelo fluxo canônico e vincula à empresa', async () => {
    mockResourceAccess.assertCanRead.mockResolvedValue(undefined);
    mockCreateMessagingContact.execute.mockResolvedValue({ id: 'mc-1', phone: '5511999990000', name: 'Fulano' });
    mockPrisma.companyContact.create.mockResolvedValue({
      id: 'cc-1',
      companyId: 'company-1',
      messagingContactId: 'mc-1',
      messagingContact: { id: 'mc-1', phone: '5511999990000', name: 'Fulano' },
    });

    await useCase.execute('company-1', { phone: '5511999990000', name: 'Fulano' } as never, user);

    expect(mockCreateMessagingContact.execute).toHaveBeenCalledWith({ phone: '5511999990000', name: 'Fulano' });
    expect(mockPrisma.companyContact.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ companyId: 'company-1', messagingContactId: 'mc-1' }),
      }),
    );
  });

  it('usa MC existente (ConflictException) e vincula à empresa', async () => {
    mockResourceAccess.assertCanRead.mockResolvedValue(undefined);
    mockCreateMessagingContact.execute.mockRejectedValue(new ConflictException('exists'));
    mockPrisma.messagingContact.findUniqueOrThrow.mockResolvedValue({ id: 'mc-existente' });
    mockPrisma.companyContact.create.mockResolvedValue({
      id: 'cc-1',
      companyId: 'company-1',
      messagingContactId: 'mc-existente',
      messagingContact: { id: 'mc-existente', phone: '5511999990000', name: null },
    });

    await useCase.execute('company-1', { phone: '5511999990000' } as never, user);

    expect(mockPrisma.messagingContact.findUniqueOrThrow).toHaveBeenCalled();
    expect(mockPrisma.companyContact.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ messagingContactId: 'mc-existente' }),
      }),
    );
  });
});
