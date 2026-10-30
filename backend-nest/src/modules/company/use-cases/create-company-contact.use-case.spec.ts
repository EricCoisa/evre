import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
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
  messagingContact: { findUnique: vi.fn() },
  companyContact: { findUnique: vi.fn(), create: vi.fn() },
};
const mockI18n = { t: vi.fn().mockReturnValue('mensagem') };
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
        { provide: I18nService, useValue: mockI18n },
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
    expect(mockPrisma.messagingContact.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.companyContact.create).not.toHaveBeenCalled();
  });

  it('lança ConflictException quando o vínculo já existe', async () => {
    mockResourceAccess.assertCanRead.mockResolvedValue(undefined);
    mockPrisma.messagingContact.findUnique.mockResolvedValue({ id: 'mc-1' });
    mockPrisma.companyContact.findUnique.mockResolvedValue({ id: 'cc-existente' });

    await expect(
      useCase.execute('company-1', { phone: '5511999990000' } as never, user),
    ).rejects.toThrow(ConflictException);
    expect(mockCreateMessagingContact.execute).not.toHaveBeenCalled();
    expect(mockPrisma.companyContact.create).not.toHaveBeenCalled();
  });

  it('encontra MC existente e vincula à empresa sem chamar createMessagingContact', async () => {
    mockResourceAccess.assertCanRead.mockResolvedValue(undefined);
    mockPrisma.messagingContact.findUnique.mockResolvedValue({ id: 'mc-existente' });
    mockPrisma.companyContact.findUnique.mockResolvedValue(null);
    mockPrisma.companyContact.create.mockResolvedValue({
      id: 'cc-1',
      companyId: 'company-1',
      messagingContactId: 'mc-existente',
      messagingContact: { id: 'mc-existente', phone: '5511999990000', name: null },
    });

    await useCase.execute('company-1', { phone: '5511999990000' } as never, user);

    expect(mockCreateMessagingContact.execute).not.toHaveBeenCalled();
    expect(mockPrisma.companyContact.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ companyId: 'company-1', messagingContactId: 'mc-existente' }),
      }),
    );
  });

  it('cria o MC pelo fluxo canônico quando não existe e vincula à empresa', async () => {
    mockResourceAccess.assertCanRead.mockResolvedValue(undefined);
    mockPrisma.messagingContact.findUnique.mockResolvedValue(null);
    mockCreateMessagingContact.execute.mockResolvedValue({ id: 'mc-novo', phone: '5511999990000', name: 'Fulano' });
    mockPrisma.companyContact.findUnique.mockResolvedValue(null);
    mockPrisma.companyContact.create.mockResolvedValue({
      id: 'cc-1',
      companyId: 'company-1',
      messagingContactId: 'mc-novo',
      messagingContact: { id: 'mc-novo', phone: '5511999990000', name: 'Fulano' },
    });

    await useCase.execute('company-1', { phone: '5511999990000', name: 'Fulano' } as never, user);

    expect(mockCreateMessagingContact.execute).toHaveBeenCalledWith({ phone: '5511999990000', name: 'Fulano' });
    expect(mockPrisma.companyContact.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ companyId: 'company-1', messagingContactId: 'mc-novo' }),
      }),
    );
    expect(mockLogging.create).toHaveBeenCalledWith(
      expect.objectContaining({ module: 'COMPANY' }),
      user.id,
    );
  });
});
