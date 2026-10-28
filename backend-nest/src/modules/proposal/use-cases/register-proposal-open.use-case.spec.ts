import { Test } from '@nestjs/testing';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationService } from '../../notification/notification.service';
import { RegisterProposalOpenUseCase } from './register-proposal-open.use-case';

const mockTx = {
  proposalOpenEvent: {
    count: vi.fn(),
    create: vi.fn(),
  },
};

const mockPrisma = {
  proposalVersion: { findUnique: vi.fn() },
  $transaction: vi.fn((operation: (tx: typeof mockTx) => Promise<unknown>) =>
    operation(mockTx),
  ),
};

const mockNotification = { notify: vi.fn() };
const mockI18n = { t: vi.fn((key: string) => key) };

const resolvedVersion = {
  id: 'version-1',
  proposal: { id: 'proposal-1', ownerId: 'owner-1', name: 'Proposta X' },
};

describe('RegisterProposalOpenUseCase', () => {
  let useCase: RegisterProposalOpenUseCase;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        RegisterProposalOpenUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationService, useValue: mockNotification },
        { provide: I18nService, useValue: mockI18n },
      ],
    }).compile();
    useCase = module.get(RegisterProposalOpenUseCase);
    vi.clearAllMocks();
    mockPrisma.proposalVersion.findUnique.mockResolvedValue(resolvedVersion);
  });

  it('grava o evento sempre, mesmo quando não é a primeira abertura', async () => {
    mockTx.proposalOpenEvent.count.mockResolvedValueOnce(1);

    await useCase.execute({ token: 'tok', ip: '1.2.3.4', userAgent: 'agent' });

    expect(mockTx.proposalOpenEvent.create).toHaveBeenCalledWith({
      data: { versionId: 'version-1', ip: '1.2.3.4', userAgent: 'agent' },
    });
  });

  it('primeira abertura daquela versão notifica o dono', async () => {
    mockTx.proposalOpenEvent.count.mockResolvedValueOnce(0);

    await useCase.execute({ token: 'tok' });

    expect(mockNotification.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        recipients: { userIds: ['owner-1'] },
        actionUrl: '/proposal/proposal-1?tab=publicacao',
        channels: { whatsapp: true },
      }),
    );
  });

  it('segunda abertura da mesma versão NÃO notifica', async () => {
    mockTx.proposalOpenEvent.count.mockResolvedValueOnce(1);

    await useCase.execute({ token: 'tok' });

    expect(mockNotification.notify).not.toHaveBeenCalled();
  });

  it('abertura de versão diferente notifica de novo (contagem por versionId)', async () => {
    mockTx.proposalOpenEvent.count.mockResolvedValueOnce(0);
    mockPrisma.proposalVersion.findUnique.mockResolvedValueOnce({
      id: 'version-2',
      proposal: { id: 'proposal-1', ownerId: 'owner-1', name: 'Proposta X' },
    });

    await useCase.execute({ token: 'tok-v2' });

    expect(mockTx.proposalOpenEvent.count).toHaveBeenCalledWith({
      where: { versionId: 'version-2' },
    });
    expect(mockNotification.notify).toHaveBeenCalledTimes(1);
  });

  it('token sem versão resolvida não grava nem notifica (corrida rara)', async () => {
    mockPrisma.proposalVersion.findUnique.mockResolvedValueOnce(null);

    await useCase.execute({ token: 'sumiu' });

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockNotification.notify).not.toHaveBeenCalled();
  });
});
