import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailProcessor } from './email.processor';
import { PrismaService } from '../../prisma/prisma.service';
import { SystemConfigurationService } from '../system-configuration/system-configuration.service';
import { ResendEmailService } from './provider/resend.provider';
import { NodemailerEmailService } from './provider/nodemailer.provider';
import { RedisService } from 'src/common/infrastructure/redis/redis.service';
import { getQueueToken } from '@nestjs/bullmq';

const mockProviderInstance = vi.hoisted(() => ({
  send: vi.fn(),
  validateConfiguration: vi.fn(),
}));

const mockPrisma = {
  systemLog: { create: vi.fn() },
};

const mockSysConfig = {
  findByLabelKey: vi.fn(),
  getValueOrNull: vi.fn(),
};

const mockQueue = {
  add: vi.fn().mockResolvedValue({}),
};

const mockRedis = {
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(undefined),
  del: vi.fn().mockResolvedValue(undefined),
};

const mockResend = { use: vi.fn() };
const mockSmtp = { use: vi.fn() };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildModule(withQueue: boolean) {
  return Test.createTestingModule({
    providers: [
      EmailService,
      { provide: PrismaService, useValue: mockPrisma },
      { provide: SystemConfigurationService, useValue: mockSysConfig },
      { provide: ResendEmailService, useValue: mockResend },
      { provide: NodemailerEmailService, useValue: mockSmtp },
      { provide: RedisService, useValue: mockRedis },
      {
        provide: getQueueToken('email'),
        useValue: withQueue ? mockQueue : null,
      },
    ],
  }).compile();
}

/** Default config values for the happy path (RESEND engine). */
function setupDefaultMocks() {
  mockSysConfig.findByLabelKey.mockImplementation((key: string) => {
    const values: Record<string, string> = {
      SYSTEM_EMAIL_PROVIDER: 'RESEND',
      SYSTEM_EMAIL_PROVIDER_API_KEY: 're_test',
      SYSTEM_EMAIL_DEFAULT_FROM: 'no-reply@example.com',
      SYSTEM_EMAIL_SMTP_HOST: 'smtp.example.com',
      SYSTEM_EMAIL_SMTP_PORT: '587',
      SYSTEM_EMAIL_SMTP_USER: 'user',
      SYSTEM_EMAIL_SMTP_PASS: 'pass',
      SYSTEM_EMAIL_SMTP_SECURE: 'false',
    };
    return Promise.resolve(values[key] ? { value: values[key] } : null);
  });
  mockResend.use.mockReturnValue(mockProviderInstance);
  mockSmtp.use.mockReturnValue(mockProviderInstance);
  mockProviderInstance.send.mockResolvedValue({ status: true, data: 'sent' });
  mockProviderInstance.validateConfiguration.mockResolvedValue({
    status: true,
    data: 'ok',
  });
}

const baseParams = {
  to: 'dest@example.com',
  subject: 'Test',
  html: '<p>Hi</p>',
};

// ─── Queue-enabled (Redis present) ───────────────────────────────────────────

describe('EmailService — with queue', () => {
  let service: EmailService;

  beforeEach(async () => {
    const module: TestingModule = await buildModule(true);
    service = module.get<EmailService>(EmailService);
    setupDefaultMocks();
  });

  afterEach(() => vi.resetAllMocks());

  it('send enqueues with correct options and returns status=true/queued', async () => {
    const result = await service.send(baseParams);

    expect(mockQueue.add).toHaveBeenCalledWith('send', baseParams, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 30000 },
      removeOnComplete: true,
      removeOnFail: false,
    });
    expect(result).toEqual({ status: true, data: 'queued' });
  });

  it('send does not call sendNow directly when queue is present', async () => {
    const sendNowSpy = vi.spyOn(service, 'sendNow');
    await service.send(baseParams);
    expect(sendNowSpy).not.toHaveBeenCalled();
  });
});

// ─── Queue-disabled (no Redis) ────────────────────────────────────────────────

describe('EmailService — without queue (sync fallback)', () => {
  let service: EmailService;

  beforeEach(async () => {
    const module: TestingModule = await buildModule(false);
    service = module.get<EmailService>(EmailService);
    setupDefaultMocks();
  });

  afterEach(() => vi.resetAllMocks());

  it('send falls back to sendNow when queue is null', async () => {
    const result = await service.send(baseParams);
    expect(result).toEqual({ status: true, data: 'sent' });
    expect(mockQueue.add).not.toHaveBeenCalled();
  });

  it('send returns successful result when provider.send succeeds', async () => {
    const result = await service.send(baseParams);
    expect(result).toEqual({ status: true, data: 'sent' });
    expect(mockPrisma.systemLog.create).not.toHaveBeenCalled();
  });

  it('send uses SMTP provider when configured', async () => {
    mockSysConfig.findByLabelKey.mockImplementation((key: string) => {
      const values: Record<string, string> = {
        SYSTEM_EMAIL_PROVIDER: 'SMTP',
        SYSTEM_EMAIL_DEFAULT_FROM: 'no-reply@example.com',
        SYSTEM_EMAIL_SMTP_HOST: 'smtp.example.com',
        SYSTEM_EMAIL_SMTP_PORT: '587',
        SYSTEM_EMAIL_SMTP_USER: 'user',
        SYSTEM_EMAIL_SMTP_PASS: 'pass',
        SYSTEM_EMAIL_SMTP_SECURE: 'false',
      };
      return Promise.resolve(values[key] ? { value: values[key] } : null);
    });

    const result = await service.send(baseParams);
    expect(result.status).toBe(true);
    expect(mockSmtp.use).toHaveBeenCalled();
  });

  it('sendNow does not fetch DEFAULT_FROM when params.from is provided', async () => {
    await service.send({ ...baseParams, from: 'custom@example.com' });
    expect(mockSysConfig.findByLabelKey).not.toHaveBeenCalledWith(
      'SYSTEM_EMAIL_DEFAULT_FROM',
    );
  });

  it('send logs failure and returns result when provider.send returns status=false', async () => {
    mockProviderInstance.send.mockResolvedValue({
      status: false,
      data: 'delivery failed',
    });
    mockPrisma.systemLog.create.mockResolvedValue({});

    const result = await service.send(baseParams);
    expect(result.status).toBe(false);
    expect(mockPrisma.systemLog.create).toHaveBeenCalled();
  });

  it('send catches provider errors, logs them and returns status=false', async () => {
    mockProviderInstance.send.mockRejectedValue(new Error('send fail'));
    mockPrisma.systemLog.create.mockResolvedValue({});

    const result = await service.send(baseParams);
    expect(result.status).toBe(false);
    expect(mockPrisma.systemLog.create).toHaveBeenCalled();
  });

  it('send uses null for html when html field is not provided', async () => {
    const result = await service.send({
      to: 'dest@example.com',
      subject: 'Test',
      text: 'hello',
    });
    expect(result.status).toBe(true);
    expect(mockProviderInstance.send).toHaveBeenCalledWith(
      expect.objectContaining({ html: null }),
    );
  });

  it('send catches null error and uses String(error) as message fallback', async () => {
    mockProviderInstance.send.mockRejectedValue(null);
    mockPrisma.systemLog.create.mockResolvedValue({});
    const result = await service.send(baseParams);
    expect(result.status).toBe(false);
    expect(mockPrisma.systemLog.create).toHaveBeenCalled();
  });

  // performedById pode apontar pra um usuário que não existe mais (ex.: FK violada) — o log é
  // só auditoria, e uma falha nele nunca pode escalar pra quebrar o envio que está sendo auditado.
  it('send does not throw when systemLog.create itself fails (e.g. FK on performedById)', async () => {
    mockProviderInstance.send.mockResolvedValue({
      status: false,
      data: 'delivery failed',
    });
    mockPrisma.systemLog.create.mockRejectedValue(
      new Error('Foreign key constraint violated'),
    );

    const result = await service.send({
      ...baseParams,
      performedById: 'stale-user-id',
    });

    expect(result.status).toBe(false);
    expect(result.data).toBe('delivery failed');
  });

  it('send does not throw when systemLog.create fails inside the catch (provider itself threw)', async () => {
    mockProviderInstance.send.mockRejectedValue(new Error('smtp exploded'));
    mockPrisma.systemLog.create.mockRejectedValue(
      new Error('Foreign key constraint violated'),
    );

    const result = await service.send({
      ...baseParams,
      performedById: 'stale-user-id',
    });

    expect(result.status).toBe(false);
    expect(result.data).toBe('smtp exploded');
  });

  // ─── validateConfiguration ────────────────────────────────────

  it('validateConfiguration returns provider result on success', async () => {
    const result = await service.validateConfiguration();
    expect(result).toEqual({ status: true, data: 'ok' });
  });

  it('validateConfiguration returns status=false when provider validateConfiguration throws', async () => {
    mockProviderInstance.validateConfiguration.mockRejectedValue(
      new Error('fail'),
    );

    const result = await service.validateConfiguration();
    expect(result).toEqual({ status: false, data: 'fail' });
  });
});

// ─── checkHealth ─────────────────────────────────────────────────────────────

describe('EmailService.checkHealth', () => {
  let service: EmailService;

  beforeEach(async () => {
    const module: TestingModule = await buildModule(false);
    service = module.get<EmailService>(EmailService);
    setupDefaultMocks();
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  afterEach(() => vi.resetAllMocks());

  it('cache hit: returns cached result without calling validateConfiguration', async () => {
    mockRedis.get.mockResolvedValue(JSON.stringify({ operational: true }));

    const result = await service.checkHealth();

    expect(result).toEqual({ operational: true });
    expect(mockRedis.set).not.toHaveBeenCalled();
    expect(mockProviderInstance.validateConfiguration).not.toHaveBeenCalled();
  });

  it('cache miss: calls validateConfiguration, writes to cache and returns result', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockProviderInstance.validateConfiguration.mockResolvedValue({
      status: true,
      data: 'ok',
    });

    const result = await service.checkHealth();

    expect(result).toEqual({ operational: true });
    expect(mockProviderInstance.validateConfiguration).toHaveBeenCalledTimes(1);
    expect(mockRedis.set).toHaveBeenCalledWith(
      'email:health',
      JSON.stringify({ operational: true }),
      300,
    );
  });

  it('cache miss with failing provider: returns operational=false with reason', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockProviderInstance.validateConfiguration.mockResolvedValue({
      status: false,
      data: 'invalid api key',
    });

    const result = await service.checkHealth();

    expect(result).toEqual({ operational: false, reason: 'invalid api key' });
    expect(mockRedis.set).toHaveBeenCalledWith(
      'email:health',
      JSON.stringify({ operational: false, reason: 'invalid api key' }),
      300,
    );
  });

  it('redis down (get returns null): falls through to live check without loop', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue(undefined); // set silently ignored
    mockProviderInstance.validateConfiguration.mockResolvedValue({
      status: true,
      data: 'ok',
    });

    const result = await service.checkHealth();

    expect(result.operational).toBe(true);
    expect(mockProviderInstance.validateConfiguration).toHaveBeenCalledTimes(1);
  });
});

// ─── renderTemplate / listTemplates ──────────────────────────────────────────

describe('EmailService.renderTemplate', () => {
  let service: EmailService;

  beforeEach(async () => {
    const module: TestingModule = await buildModule(false);
    service = module.get<EmailService>(EmailService);
    vi.resetAllMocks();
  });

  it('usa o arquivo de disco quando não há override gravado', async () => {
    mockSysConfig.getValueOrNull.mockResolvedValue(null);

    const html = await service.renderTemplate('INVITATION', {
      name: 'World',
      organization: 'Acme',
      message: 'hi',
      action_url: 'http://x',
    });

    expect(html).toContain('Aceitar convite');
    expect(html).toContain('World');
  });

  it('usa o override gravado em EMAIL_TEMPLATES quando existe para o tipo', async () => {
    mockSysConfig.getValueOrNull.mockResolvedValue(
      JSON.stringify({ INVITATION: '<p>Oi {{ name }}</p>' }),
    );

    const html = await service.renderTemplate('INVITATION', {
      name: 'World',
    });

    expect(html).toBe('<p>Oi World</p>');
    expect(html).not.toContain('Aceitar convite');
  });

  it('cai no disco quando o JSON gravado é inválido', async () => {
    mockSysConfig.getValueOrNull.mockResolvedValue('{not json');

    const html = await service.renderTemplate('INVITATION', { name: 'X' });

    expect(html).toContain('Aceitar convite');
  });

  it('cai no disco quando o tipo não tem entrada no mapa gravado', async () => {
    mockSysConfig.getValueOrNull.mockResolvedValue(
      JSON.stringify({ PASSWORD_RESET: '<p>outro tipo</p>' }),
    );

    const html = await service.renderTemplate('INVITATION', { name: 'X' });

    expect(html).toContain('Aceitar convite');
  });

  it('escapa HTML de variáveis interpoladas, tanto no default de disco quanto no override', async () => {
    const xss = '<script>alert(1)</script>';

    mockSysConfig.getValueOrNull.mockResolvedValue(null);
    const fromDisk = await service.renderTemplate('INVITATION', {
      name: xss,
      organization: 'Acme',
      message: 'hi',
      action_url: 'http://x',
    });
    expect(fromDisk).not.toContain(xss);
    expect(fromDisk).toContain('&lt;script&gt;');

    mockSysConfig.getValueOrNull.mockResolvedValue(
      JSON.stringify({ INVITATION: '<p>Oi {{ name }}</p>' }),
    );
    const fromOverride = await service.renderTemplate('INVITATION', {
      name: xss,
    });
    expect(fromOverride).not.toContain(xss);
    expect(fromOverride).toContain('&lt;script&gt;');
  });
});

describe('EmailService.listTemplates', () => {
  let service: EmailService;

  beforeEach(async () => {
    const module: TestingModule = await buildModule(false);
    service = module.get<EmailService>(EmailService);
    vi.resetAllMocks();
  });

  it('marca isDefault=true e html=defaultHtml quando não há override', async () => {
    mockSysConfig.getValueOrNull.mockResolvedValue(null);

    const list = await service.listTemplates();
    const invitation = list.find((t) => t.type === 'INVITATION');

    expect(invitation?.isDefault).toBe(true);
    expect(invitation?.html).toBe(invitation?.defaultHtml);
    expect(invitation?.defaultHtml).toContain('Aceitar convite');
  });

  it('marca isDefault=false e html=override para o tipo customizado, mantendo o outro no default', async () => {
    mockSysConfig.getValueOrNull.mockResolvedValue(
      JSON.stringify({ INVITATION: '<p>customizado</p>' }),
    );

    const list = await service.listTemplates();
    const invitation = list.find((t) => t.type === 'INVITATION');
    const passwordReset = list.find((t) => t.type === 'PASSWORD_RESET');

    expect(invitation?.isDefault).toBe(false);
    expect(invitation?.html).toBe('<p>customizado</p>');
    expect(invitation?.defaultHtml).toContain('Aceitar convite');

    expect(passwordReset?.isDefault).toBe(true);
    expect(passwordReset?.html).toBe(passwordReset?.defaultHtml);
  });
});

// ─── invalidateHealthCache ───────────────────────────────────────────────────

describe('EmailService.invalidateHealthCache', () => {
  it('deletes the health key from Redis', async () => {
    const module: TestingModule = await buildModule(false);
    const service = module.get<EmailService>(EmailService);
    await service.invalidateHealthCache();
    expect(mockRedis.del).toHaveBeenCalledWith('email:health');
  });
});

// ─── validateCandidate ────────────────────────────────────────────────────────

describe('EmailService.validateCandidate', () => {
  let service: EmailService;

  beforeEach(async () => {
    const module: TestingModule = await buildModule(false);
    service = module.get<EmailService>(EmailService);
    vi.resetAllMocks();
    mockResend.use.mockReturnValue(mockProviderInstance);
    mockSmtp.use.mockReturnValue(mockProviderInstance);
  });

  it('valida credenciais candidatas de SMTP, ainda não gravadas', async () => {
    mockProviderInstance.validateConfiguration.mockResolvedValue({
      status: true,
      data: 'ok',
    });

    const result = await service.validateCandidate({
      provider: 'SMTP',
      defaultFrom: 'a@b.com',
      smtp: { host: 'h', port: 587, user: 'u', pass: 'p', secure: false } as never,
    });

    expect(mockSmtp.use).toHaveBeenCalled();
    expect(result).toEqual({ status: true, data: 'ok' });
  });

  it('valida credenciais candidatas de Resend, ainda não gravadas', async () => {
    mockProviderInstance.validateConfiguration.mockResolvedValue({
      status: true,
      data: 'ok',
    });

    const result = await service.validateCandidate({
      provider: 'RESEND',
      defaultFrom: 'a@b.com',
      resend: { apiKey: 're_x' } as never,
    });

    expect(mockResend.use).toHaveBeenCalled();
    expect(result).toEqual({ status: true, data: 'ok' });
  });

  it('devolve status=false quando o provider rejeita a candidata', async () => {
    mockProviderInstance.validateConfiguration.mockRejectedValue(
      new Error('bad key'),
    );

    const result = await service.validateCandidate({
      provider: 'RESEND',
      defaultFrom: 'a@b.com',
      resend: { apiKey: 're_x' } as never,
    });

    expect(result).toEqual({ status: false, data: 'bad key' });
  });
});

// ─── fallbacks de config ausente (nem SystemConfiguration, nem env) ──────────

describe('EmailService — fallback de config ausente', () => {
  let service: EmailService;
  const envBackup: Record<string, string | undefined> = {};
  const ENV_KEYS = [
    'RESEND_API_KEY',
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_USER',
    'SMTP_PASS',
    'SMTP_SECURE',
  ];

  beforeEach(async () => {
    for (const k of ENV_KEYS) {
      envBackup[k] = process.env[k];
      delete process.env[k];
    }
    const module: TestingModule = await buildModule(false);
    service = module.get<EmailService>(EmailService);
    vi.resetAllMocks();
    mockResend.use.mockReturnValue(mockProviderInstance);
    mockSmtp.use.mockReturnValue(mockProviderInstance);
    mockProviderInstance.validateConfiguration.mockResolvedValue({
      status: true,
      data: 'ok',
    });
    mockSysConfig.findByLabelKey.mockResolvedValue(null);
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (envBackup[k] === undefined) delete process.env[k];
      else process.env[k] = envBackup[k];
    }
  });

  it('Resend sem config nem env usa apiKey vazia', async () => {
    await service.validateConfiguration();

    expect(mockResend.use).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: '' }),
    );
  });

  it('SMTP sem config nem env usa os defaults vazios/587/false', async () => {
    mockSysConfig.findByLabelKey.mockImplementation((key: string) =>
      Promise.resolve(key === 'SYSTEM_EMAIL_PROVIDER' ? { value: 'SMTP' } : null),
    );

    await service.validateConfiguration();

    expect(mockSmtp.use).toHaveBeenCalledWith(
      expect.objectContaining({
        host: '',
        port: 587,
        user: '',
        pass: '',
        secure: false,
      }),
    );
  });
});

// ─── readConfigValue: NotFoundException vs. erro real ────────────────────────

describe('EmailService — readConfigValue', () => {
  let service: EmailService;

  beforeEach(async () => {
    const module: TestingModule = await buildModule(false);
    service = module.get<EmailService>(EmailService);
    vi.resetAllMocks();
  });

  it('chave ausente (NotFoundException) é tratada como "sem valor", não como falha', async () => {
    mockSysConfig.findByLabelKey.mockRejectedValue(new NotFoundException());
    mockResend.use.mockReturnValue(mockProviderInstance);
    mockProviderInstance.validateConfiguration.mockResolvedValue({
      status: true,
      data: 'ok',
    });

    const result = await service.validateConfiguration();

    expect(result).toEqual({ status: true, data: 'ok' });
  });

  it('erro real ao ler a config propaga e falha a validação', async () => {
    mockSysConfig.findByLabelKey.mockRejectedValue(new Error('db fora'));

    const result = await service.validateConfiguration();

    expect(result).toEqual({ status: false, data: 'db fora' });
  });
});

// ─── sendNow: DEFAULT_FROM ausente ────────────────────────────────────────────

describe('EmailService.sendNow — from ausente e sem default configurado', () => {
  it('segue sem from quando nem o parâmetro nem SYSTEM_EMAIL_DEFAULT_FROM existem', async () => {
    const module: TestingModule = await buildModule(false);
    const service = module.get<EmailService>(EmailService);
    vi.resetAllMocks();
    mockSysConfig.findByLabelKey.mockResolvedValue(null);
    mockResend.use.mockReturnValue(mockProviderInstance);
    mockProviderInstance.send.mockResolvedValue({ status: true, data: 'sent' });

    const result = await service.sendNow({
      to: 'dest@example.com',
      subject: 'Test',
      html: '<p>Hi</p>',
    });

    expect(result.status).toBe(true);
    expect(mockProviderInstance.send).toHaveBeenCalledWith(
      expect.objectContaining({ from: undefined }),
    );
  });
});

// ─── EmailProcessor ───────────────────────────────────────────────────────────

describe('EmailProcessor', () => {
  it('process calls emailService.sendNow with job data', async () => {
    const mockEmailService = {
      sendNow: vi.fn().mockResolvedValue({ status: true }),
    };
    const processor = new EmailProcessor(
      mockEmailService as unknown as EmailService,
    );

    const job = { data: baseParams } as Parameters<
      EmailProcessor['process']
    >[0];
    await processor.process(job);

    expect(mockEmailService.sendNow).toHaveBeenCalledWith(baseParams);
  });
});
