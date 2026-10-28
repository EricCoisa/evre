import { Test } from '@nestjs/testing';
import { RequestPasswordResetUseCase } from './request-password-reset.use-case';
import { PrismaService } from 'src/prisma/prisma.service';
import { EmailService } from '../../email/email.service';
import { LoggingService } from '../../logging/logging.service';
import { I18nService } from 'nestjs-i18n';
import { SystemConfigurationService } from '../../system-configuration/system-configuration.service';
import { RedisService } from '../../../common/infrastructure/redis/redis.service';
import { ShortUrlService } from '../../short-url/short-url.service';

const mockPrisma = {
  user: { findUnique: vi.fn() },
  passwordResetToken: { deleteMany: vi.fn(), create: vi.fn() },
};
const mockEmail = {
  send: vi.fn(),
  renderTemplate: vi.fn().mockResolvedValue('<html>reset</html>'),
  checkHealth: vi.fn(),
};
const mockLogging = { create: vi.fn() };
const mockI18n = { t: vi.fn((k: string) => k) };
const mockSysConfig = {
  findByLabelKey: vi.fn().mockResolvedValue({ value: 'MyApp' }),
};
// `true` = primeiro pedido da janela. O use-case só segue quando o setnx concede.
const mockRedis = { setnx: vi.fn() };
const mockShortUrl = {
  shorten: vi.fn().mockResolvedValue({
    id: 'short-reset-1',
    code: 'rst12345',
    shortUrl: 'http://localhost:3000/s/rst12345',
    targetUrl: 'http://localhost:3000/reset-password?token=xyz',
    purpose: 'PASSWORD_RESET',
    clicksCount: 0,
    maxClicks: null,
    expiresAt: new Date(),
    createdAt: new Date(),
  }),
};

const user = { id: 'u1', email: 'a@b.com', name: 'Test' };

describe('RequestPasswordResetUseCase', () => {
  let useCase: RequestPasswordResetUseCase;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        RequestPasswordResetUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EmailService, useValue: mockEmail },
        { provide: LoggingService, useValue: mockLogging },
        { provide: I18nService, useValue: mockI18n },
        { provide: SystemConfigurationService, useValue: mockSysConfig },
        { provide: RedisService, useValue: mockRedis },
        { provide: ShortUrlService, useValue: mockShortUrl },
      ],
    }).compile();
    useCase = mod.get(RequestPasswordResetUseCase);
    vi.clearAllMocks();
    mockEmail.send.mockResolvedValue(undefined);
    mockEmail.checkHealth.mockResolvedValue({ operational: true });
    mockLogging.create.mockResolvedValue(undefined);
    mockPrisma.passwordResetToken.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.passwordResetToken.create.mockResolvedValue({});
    mockSysConfig.findByLabelKey.mockResolvedValue({ value: 'MyApp' });
    mockRedis.setnx.mockResolvedValue(true);
    mockShortUrl.shorten.mockResolvedValue({
      id: 'short-reset-1',
      code: 'rst12345',
      shortUrl: 'http://localhost:3000/s/rst12345',
      targetUrl: 'http://localhost:3000/reset-password?token=xyz',
      purpose: 'PASSWORD_RESET',
      clicksCount: 0,
      maxClicks: null,
      expiresAt: new Date(),
      createdAt: new Date(),
    });
  });

  it('cria token, encurta link e envia email para email existente', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(user);

    await useCase.execute('a@b.com');

    expect(mockPrisma.passwordResetToken.create).toHaveBeenCalled();
    expect(mockShortUrl.shorten).toHaveBeenCalledWith(
      expect.objectContaining({
        purpose: 'PASSWORD_RESET',
        createdById: 'u1',
      }),
    );
    expect(mockEmail.renderTemplate).toHaveBeenCalledWith(
      'PASSWORD_RESET',
      expect.objectContaining({
        action_url: 'http://localhost:3000/s/rst12345',
      }),
    );
    expect(mockEmail.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'a@b.com' }),
    );
  });

  it('não faz nada se email não existe (sem revelar existência)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await useCase.execute('ghost@b.com');

    expect(mockPrisma.passwordResetToken.create).not.toHaveBeenCalled();
    expect(mockEmail.send).not.toHaveBeenCalled();
    expect(mockLogging.create).toHaveBeenCalled(); // logs a tentativa
  });

  it('normaliza email para lowercase antes de buscar', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await useCase.execute('  UPPER@B.COM  ');

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'upper@b.com' },
    });
  });

  it('segundo pedido dentro da janela não manda e-mail (anti-bombardeio)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(user);
    mockRedis.setnx.mockResolvedValue(false); // janela já aberta para este e-mail

    await useCase.execute('a@b.com');

    expect(mockEmail.send).not.toHaveBeenCalled();
    // Nem chega a consultar o usuário: o teto é por destinatário, não por existência.
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    expect(mockLogging.create).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ throttled: true }),
      }),
      null,
    );
  });

  it('a janela é por e-mail normalizado, não pela string crua', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(user);

    await useCase.execute('a@b.com');
    const [firstKey] = mockRedis.setnx.mock.calls[0];

    await useCase.execute('  A@B.COM  ');
    const [secondKey] = mockRedis.setnx.mock.calls[1];

    // Sem isto, trocar a caixa das letras abriria uma janela nova por variação.
    expect(secondKey).toBe(firstKey);
  });

  it('exclui tokens pendentes antes de criar novo', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(user);

    await useCase.execute('a@b.com');

    expect(mockPrisma.passwordResetToken.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1', usedAt: null } }),
    );
  });
  it('throws ServiceUnavailableException when email service is not operational', async () => {
    mockEmail.checkHealth.mockResolvedValue({ operational: false });

    await expect(useCase.execute('a@b.com')).rejects.toThrow();
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });
});
