import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { UpdateCompanyContactUseCase } from './update-company-contact.use-case';
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

describe('UpdateCompanyContactUseCase', () => {
  let useCase: UpdateCompanyContactUseCase;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateCompanyContactUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: I18nService, useValue: mockI18n },
        { provide: LoggingService, useValue: mockLogging },
        { provide: ResourceAccessService, useValue: mockResourceAccess },
      ],
    }).compile();
    useCase = module.get<UpdateCompanyContactUseCase>(
      UpdateCompanyContactUseCase,
    );
  });

  afterEach(() => vi.clearAllMocks());

  it('nega antes de ler o contato quem não tem Membership na empresa', async () => {
    mockResourceAccess.assertCanRead.mockRejectedValue(
      new NotFoundException('mensagem'),
    );

    await expect(
      useCase.execute('company-1', 'contact-1', { role: 'CEO' } as never, user),
    ).rejects.toThrow(NotFoundException);
    expect(mockPrisma.companyContact.findFirst).not.toHaveBeenCalled();
  });

  it('lança NotFoundException quando o contato não pertence à empresa informada', async () => {
    mockResourceAccess.assertCanRead.mockResolvedValue(undefined);
    mockPrisma.companyContact.findFirst.mockResolvedValue(null);

    await expect(
      useCase.execute('company-1', 'contact-de-outra-empresa', { role: 'CEO' } as never, user),
    ).rejects.toThrow(NotFoundException);
    expect(mockPrisma.companyContact.update).not.toHaveBeenCalled();
  });

  it('atualiza o vínculo e registra no audit trail', async () => {
    mockResourceAccess.assertCanRead.mockResolvedValue(undefined);
    mockPrisma.companyContact.findFirst.mockResolvedValue({
      id: 'cc-1',
      companyId: 'company-1',
      messagingContact: { id: 'mc-1', phone: '5511999990000', name: 'Fulano' },
    });
    mockPrisma.companyContact.update.mockResolvedValue({
      id: 'cc-1',
      role: 'CEO',
      messagingContact: { id: 'mc-1', phone: '5511999990000', name: 'Fulano' },
    });

    await useCase.execute('company-1', 'cc-1', { role: 'CEO' } as never, user);

    expect(mockPrisma.companyContact.update).toHaveBeenCalledWith({
      where: { id: 'cc-1' },
      data: { role: 'CEO' },
      include: { messagingContact: true },
    });
    expect(mockLogging.create).toHaveBeenCalledWith(
      expect.objectContaining({ module: 'COMPANY' }),
      user.id,
    );
  });
});
