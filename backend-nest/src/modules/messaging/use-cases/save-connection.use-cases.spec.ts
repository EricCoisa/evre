import { BadRequestException, ConflictException } from '@nestjs/common';
import { CreateConnectionUseCase } from './create-connection.use-case';
import { UpdateConnectionUseCase } from './update-connection.use-case';
import { buildConfig } from './connection-config.util';
import { EvolutionApiProvider } from '../providers/evolution-api.provider';

const evoAdapter = {
  configFields: ['baseUrl', 'token', 'instance', 'webhookSecret'],
  secretFields: ['token', 'webhookSecret'],
};

describe('buildConfig', () => {
  it('só passam os campos do provider; segredo em branco mantém o gravado', () => {
    const config = buildConfig(
      {
        configFields: ['phoneNumberId', 'accessToken'],
        secretFields: ['accessToken'],
      } as never,
      { phoneNumberId: ' 123 ', accessToken: '', intruso: 'x' },
      { accessToken: 'antigo' },
    );
    expect(config).toEqual({ phoneNumberId: '123', accessToken: 'antigo' });
  });

  // `systemFields` é quem gera o `instance`: o formulário nem chega a enviar esse campo hoje.
  it('Evolution API: gera UUID da instância ao criar e o mantém ao editar', () => {
    const adapter = new EvolutionApiProvider();
    const created = buildConfig(adapter, {
      baseUrl: 'http://e',
      token: 't',
      instance: 'digitado-a-mão',
    });
    expect(created.instance).toMatch(/^[0-9a-f-]{36}$/);

    const edited = buildConfig(
      adapter,
      { baseUrl: 'http://e' },
      { instance: 'legado', token: 't' },
    );
    expect(edited).toMatchObject({ instance: 'legado', token: 't' });
  });
});

describe('CreateConnectionUseCase / UpdateConnectionUseCase', () => {
  const conn = { id: 'c1', provider: 'EVOLUTION_API', phone: null };
  const connections = {
    findByProvider: vi.fn(),
    getActive: vi.fn(),
    create: vi.fn(),
    updateConfig: vi.fn(),
    bindPhone: vi.fn(),
    encode: vi.fn((_p: string, c: object) => c),
    plainConfig: vi.fn().mockReturnValue({ token: 'antigo' }),
    view: vi.fn((c: object) => c),
  };
  const registry = { get: vi.fn().mockReturnValue(evoAdapter) };
  const messaging = { inspectCandidate: vi.fn() };
  const webhooks = {
    registerWebhookReport: vi
      .fn()
      .mockResolvedValue({ registered: true, url: 'u', message: 'ok' }),
  };
  const state = { reset: vi.fn() };
  const systemConfig = { setManyByLabelKey: vi.fn() };
  const i18n = { t: (k: string) => k };

  const create = new CreateConnectionUseCase(
    connections as never,
    registry as never,
    messaging as never,
    webhooks as never,
    systemConfig as never,
    i18n as never,
  );
  const update = new UpdateConnectionUseCase(
    connections as never,
    registry as never,
    messaging as never,
    webhooks as never,
    state as never,
    systemConfig as never,
    i18n as never,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    connections.findByProvider.mockResolvedValue(null);
    connections.getActive.mockResolvedValue(conn);
    connections.create.mockResolvedValue(conn);
    connections.updateConfig.mockResolvedValue(conn);
    connections.bindPhone.mockResolvedValue({ ...conn, phone: '5511' });
    connections.encode.mockImplementation((_p: string, c: object) => c);
    connections.plainConfig.mockReturnValue({ token: 'antigo' });
    connections.view.mockImplementation((c: object) => c);
    messaging.inspectCandidate.mockResolvedValue({
      result: { status: true, data: 'ok' },
      accountPhone: null,
    });
    webhooks.registerWebhookReport.mockResolvedValue({
      registered: true,
      url: 'u',
      message: 'ok',
    });
  });

  describe('criar', () => {
    it('exige o provider', async () => {
      await expect(create.execute({} as never, 'u')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('um provider só pode ter uma conexão (por ora)', async () => {
      connections.findByProvider.mockResolvedValue(conn);
      await expect(
        create.execute({ provider: 'EVOLUTION_API' } as never, 'u'),
      ).rejects.toThrow(ConflictException);
      expect(connections.create).not.toHaveBeenCalled();
    });

    it('credencial recusada pelo provider não grava nada', async () => {
      messaging.inspectCandidate.mockResolvedValue({
        result: { status: false, data: 'Unauthorized' },
        accountPhone: null,
      });
      await expect(
        create.execute(
          {
            provider: 'EVOLUTION_API',
            baseUrl: 'http://e',
            token: 't',
          } as never,
          'u',
        ),
      ).rejects.toThrow();
      expect(connections.create).not.toHaveBeenCalled();
    });

    it('grava com o número da conta (Meta), registra o webhook e salva o override público', async () => {
      messaging.inspectCandidate.mockResolvedValue({
        result: { status: true, data: 'ok' },
        accountPhone: '5511999999999',
      });
      const res = await create.execute(
        {
          provider: 'EVOLUTION_API',
          baseUrl: 'http://e',
          token: 't',
          webhookPublicUrl: 'https://x',
        } as never,
        'u',
      );

      expect(connections.create).toHaveBeenCalledWith(
        'EVOLUTION_API',
        expect.any(Object),
        '5511999999999',
      );
      expect(systemConfig.setManyByLabelKey).toHaveBeenCalledOnce();
      expect(webhooks.registerWebhookReport).toHaveBeenCalledWith('c1');
      expect(res.webhook.registered).toBe(true);
    });
  });

  describe('editar', () => {
    it('provider é imutável', async () => {
      await expect(
        update.execute('c1', { provider: 'META' } as never, 'u'),
      ).rejects.toThrow(BadRequestException);
    });

    it('credenciais de OUTRO número são recusadas', async () => {
      connections.getActive.mockResolvedValue({ ...conn, phone: '5511111111111' });
      messaging.inspectCandidate.mockResolvedValue({
        result: { status: true, data: 'ok' },
        accountPhone: '5522222222222',
      });

      await expect(
        update.execute('c1', { baseUrl: 'http://e' } as never, 'u'),
      ).rejects.toThrow(BadRequestException);
      expect(connections.updateConfig).not.toHaveBeenCalled();
    });

    it('mesmo número passa; segredo em branco mantém; estado é zerado e webhook reregistrado', async () => {
      connections.getActive.mockResolvedValue({ ...conn, phone: '5511111111111' });
      messaging.inspectCandidate.mockResolvedValue({
        result: { status: true, data: 'ok' },
        accountPhone: '5511111111111',
      });

      await update.execute(
        'c1',
        { baseUrl: 'http://e', token: '' } as never,
        'u',
      );

      expect(messaging.inspectCandidate).toHaveBeenCalledWith({
        provider: 'EVOLUTION_API',
        config: expect.objectContaining({ token: 'antigo' }),
      });
      expect(state.reset).toHaveBeenCalledWith('c1');
      expect(webhooks.registerWebhookReport).toHaveBeenCalledWith('c1');
      expect(connections.bindPhone).not.toHaveBeenCalled();
    });

    it('conexão sem número ainda amarra o número da conta ao editar', async () => {
      messaging.inspectCandidate.mockResolvedValue({
        result: { status: true, data: 'ok' },
        accountPhone: '5511',
      });
      await update.execute('c1', { baseUrl: 'http://e' } as never, 'u');
      expect(connections.bindPhone).toHaveBeenCalledWith('c1', '5511');
    });
  });
});
