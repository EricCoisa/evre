import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { ArchiveCompanyContactUseCase } from './archive-company-contact.use-case';
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
  companyContact: { findFirst: vi.fn(), update: vi.fn() },
};
const mockI18n = { t: vi.fn().mockReturnValue('mensagem') };
const mockLogging = { create: vi.fn() };
const mockResourceAccess = { assertCanRead: vi.fn() };

describe('ArchiveCompanyContactUseCase', () => {
  let useCase: ArchiveCompanyContactUseCase;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArchiveCompanyContactUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: I18nService, useValue: mockI18n },
        { provide: LoggingService, useValue: mockLogging },
        { provide: ResourceAccessService, useValue: mockResourceAccess },
      ],
    }).compile();
    useCase = module.get<ArchiveCompanyContactUseCase>(
      ArchiveCompanyContactUseCase,
    );
    mockResourceAccess.assertCanRead.mockResolvedValue(undefined);
  });

  afterEach(() => vi.clearAllMocks());

  it('nega antes de ler o contato quem não tem Membership na empresa', async () => {
    mockResourceAccess.assertCanRead.mockRejectedValue(
      new NotFoundException('mensagem'),
    );

    await expect(
      useCase.execute('company-1', 'contact-1', user),
    ).rejects.toThrow(NotFoundException);
    expect(mockPrisma.companyContact.findFirst).not.toHaveBeenCalled();
  });

  it('arquiva (seta archivedAt) e não apaga', async () => {
    mockPrisma.companyContact.findFirst.mockResolvedValue({
      id: 'cc-1',
      companyId: 'company-1',
      archivedAt: null,
      messagingContact: { id: 'mc-1', phone: '5511999990000', name: 'Fulano' },
    });
    mockPrisma.companyContact.update.mockResolvedValue({
      id: 'cc-1',
      archivedAt: new Date(),
      messagingContact: { id: 'mc-1', phone: '5511999990000', name: 'Fulano' },
    });

    const archived = await useCase.execute('company-1', 'cc-1', user);

    expect(mockPrisma.companyContact.update).toHaveBeenCalledWith({
      where: { id: 'cc-1' },
      data: { archivedAt: expect.any(Date) },
      include: { messagingContact: true },
    });
    expect(archived.archivedAt).toBeInstanceOf(Date);
  });

  it('é idempotente: contato já arquivado não atualiza nem loga de novo', async () => {
    mockPrisma.companyContact.findFirst.mockResolvedValue({
      id: 'cc-1',
      companyId: 'company-1',
      archivedAt: new Date(),
      messagingContact: { id: 'mc-1', phone: '5511999990000', name: 'Fulano' },
    });

    await useCase.execute('company-1', 'cc-1', user);

    expect(mockPrisma.companyContact.update).not.toHaveBeenCalled();
    expect(mockLogging.create).not.toHaveBeenCalled();
  });
});
