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
  contact: { findFirst: vi.fn(), update: vi.fn() },
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
    expect(mockPrisma.contact.findFirst).not.toHaveBeenCalled();
  });

  it('arquiva (seta archivedAt) e não apaga', async () => {
    mockPrisma.contact.findFirst.mockResolvedValue({
      id: 'contact-1',
      companyId: 'company-1',
      name: 'Fulano',
      archivedAt: null,
    });
    mockPrisma.contact.update.mockResolvedValue({
      id: 'contact-1',
      archivedAt: new Date(),
    });

    const archived = await useCase.execute('company-1', 'contact-1', user);

    expect(mockPrisma.contact.update).toHaveBeenCalledWith({
      where: { id: 'contact-1' },
      data: { archivedAt: expect.any(Date) },
    });
    expect(archived.archivedAt).toBeInstanceOf(Date);
  });

  it('é idempotente: contato já arquivado não atualiza nem loga de novo', async () => {
    mockPrisma.contact.findFirst.mockResolvedValue({
      id: 'contact-1',
      companyId: 'company-1',
      name: 'Fulano',
      archivedAt: new Date(),
    });

    await useCase.execute('company-1', 'contact-1', user);

    expect(mockPrisma.contact.update).not.toHaveBeenCalled();
    expect(mockLogging.create).not.toHaveBeenCalled();
  });
});
