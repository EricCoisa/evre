import { Test } from '@nestjs/testing';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../common/infrastructure/redis/redis.service';
import { NotificationService } from '../../notification/notification.service';
import { RequestProposalRenewalUseCase } from './request-proposal-renewal.use-case';

const mockPrisma = {
  proposalVersion: { findUnique: vi.fn() },
};
const mockRedis = { setnx: vi.fn() };
const mockNotification = { notify: vi.fn() };
const mockI18n = { t: vi.fn((key: string) => key) };

const resolvedVersion = {
  proposal: { id: 'proposal-1', ownerId: 'owner-1', name: 'Proposta X' },
};

describe('RequestProposalRenewalUseCase', () => {
  let useCase: RequestProposalRenewalUseCase;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        RequestProposalRenewalUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: NotificationService, useValue: mockNotification },
        { provide: I18nService, useValue: mockI18n },
      ],
    }).compile();
    useCase = module.get(RequestProposalRenewalUseCase);
    vi.clearAllMocks();
    mockPrisma.proposalVersion.findUnique.mockResolvedValue(resolvedVersion);
  });

  it('primeiro pedido na janela notifica o dono — não cria nem muda nada', async () => {
    mockRedis.setnx.mockResolvedValueOnce(true);

    await useCase.execute('tok');

    expect(mockNotification.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        recipients: { userIds: ['owner-1'] },
        actionUrl: '/proposal/proposal-1?tab=publicacao',
        channels: { whatsapp: true },
      }),
    );
  });

  it('segundo pedido dentro da janela é idempotente — não notifica de novo', async () => {
    mockRedis.setnx.mockResolvedValueOnce(false);

    await useCase.execute('tok');

    expect(mockNotification.notify).not.toHaveBeenCalled();
  });

  it('token inexistente é silencioso — sem notificar nem lançar', async () => {
    mockPrisma.proposalVersion.findUnique.mockResolvedValueOnce(null);

    await expect(useCase.execute('sumiu')).resolves.toBeUndefined();
    expect(mockRedis.setnx).not.toHaveBeenCalled();
    expect(mockNotification.notify).not.toHaveBeenCalled();
  });
});
