import { Test } from '@nestjs/testing';
import { CaptchaService } from './captcha.service';
import { SystemConfigurationService } from '../system-configuration/system-configuration.service';
import { captchaConfigKeys } from '../../domain/auth/captcha.const';
import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

/** Monta o `findByLabelKey` a partir de um mapa chave→valor. */
function configWith(values: Record<string, unknown>) {
  return vi.fn((key: string) => {
    if (!(key in values))
      return Promise.reject(new NotFoundException('not found'));
    return Promise.resolve({ value: values[key] });
  });
}

const turnstileOn = {
  [captchaConfigKeys.enabled]: true,
  [captchaConfigKeys.provider]: 'TURNSTILE',
  [captchaConfigKeys.siteKey]: 'site-abc',
  [captchaConfigKeys.secretKey]: 'secret-xyz',
};

const recaptchaOn = {
  ...turnstileOn,
  [captchaConfigKeys.provider]: 'RECAPTCHA_V3',
};

async function buildService(values: Record<string, unknown>) {
  const mod = await Test.createTestingModule({
    providers: [
      CaptchaService,
      {
        provide: SystemConfigurationService,
        useValue: { findByLabelKey: configWith(values) },
      },
    ],
  }).compile();
  return mod.get(CaptchaService);
}

function siteVerifyReplies(body: Record<string, unknown>) {
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CaptchaService.verify', () => {
  it('captcha desligado libera sem falar com provider nenhum', async () => {
    const service = await buildService({
      ...turnstileOn,
      [captchaConfigKeys.enabled]: false,
    });

    await expect(service.verify(undefined)).resolves.toEqual({ ok: true });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('chave faltando no banco conta como desligado (template novo sobe sem captcha)', async () => {
    const service = await buildService({});

    await expect(service.verify(undefined)).resolves.toEqual({ ok: true });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('ligado mas sem credencial preenchida bloqueia por configuração inválida', async () => {
    const service = await buildService({
      ...turnstileOn,
      [captchaConfigKeys.secretKey]: '',
    });

    await expect(service.verify(undefined)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('erro inesperado ao ler a configuração não é confundido com "desligado"', async () => {
    const mod = await Test.createTestingModule({
      providers: [
        CaptchaService,
        {
          provide: SystemConfigurationService,
          useValue: { findByLabelKey: vi.fn().mockRejectedValue(new Error('db fora')) },
        },
      ],
    }).compile();
    const service = mod.get(CaptchaService);

    await expect(service.verify(undefined)).rejects.toThrow('db fora');
  });

  it('siteverify HTTP não-ok conta como provider fora do ar', async () => {
    const service = await buildService(turnstileOn);
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    await expect(service.verify('tok-1')).resolves.toEqual({
      ok: false,
      reason: 'unavailable',
    });
  });

  it('ligado e sem token → missing_token', async () => {
    const service = await buildService(turnstileOn);

    await expect(service.verify(undefined)).resolves.toEqual({
      ok: false,
      reason: 'missing_token',
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('manda secret, token e IP no formato que os três providers esperam', async () => {
    const service = await buildService(turnstileOn);
    siteVerifyReplies({ success: true });

    await service.verify('tok-1', '203.0.113.7');

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toContain('challenges.cloudflare.com');
    const body = (init.body as URLSearchParams).toString();
    expect(body).toContain('secret=secret-xyz');
    expect(body).toContain('response=tok-1');
    expect(body).toContain('remoteip=203.0.113.7');
  });

  it('provider recusando o token → rejected', async () => {
    const service = await buildService(turnstileOn);
    siteVerifyReplies({ success: false, 'error-codes': ['invalid-input'] });

    await expect(service.verify('tok-ruim')).resolves.toEqual({
      ok: false,
      reason: 'rejected',
    });
  });

  it('provider fora do ar bloqueia a request (fail-closed)', async () => {
    const service = await buildService(turnstileOn);
    mockFetch.mockRejectedValue(new Error('network down'));

    await expect(service.verify('tok-1')).resolves.toEqual({
      ok: false,
      reason: 'unavailable',
    });
  });

  it('reCAPTCHA v3: success true com score baixo REPROVA', async () => {
    const service = await buildService(recaptchaOn);
    // A pegadinha da v3: ela responde success:true para bot também.
    siteVerifyReplies({ success: true, score: 0.1 });

    await expect(service.verify('tok-bot')).resolves.toEqual({
      ok: false,
      reason: 'low_score',
    });
  });

  it('reCAPTCHA v3: score acima do piso passa', async () => {
    const service = await buildService(recaptchaOn);
    siteVerifyReplies({ success: true, score: 0.9 });

    await expect(service.verify('tok-humano')).resolves.toEqual({ ok: true });
  });

  it('score só é avaliado em quem devolve score — Turnstile passa sem ele', async () => {
    const service = await buildService(turnstileOn);
    siteVerifyReplies({ success: true });

    await expect(service.verify('tok-1')).resolves.toEqual({ ok: true });
  });
});

describe('CaptchaService.publicConfig', () => {
  it('desligado → nada para o front desenhar', async () => {
    const service = await buildService({});

    await expect(service.publicConfig()).resolves.toEqual({
      enabled: false,
      provider: null,
      siteKey: null,
      scriptUrl: null,
    });
  });

  it('ligado mas credenciais incompletas → front sabe que está ligado, sem detalhe', async () => {
    const service = await buildService({
      ...turnstileOn,
      [captchaConfigKeys.secretKey]: '',
    });

    await expect(service.publicConfig()).resolves.toEqual({
      enabled: true,
      provider: null,
      siteKey: null,
      scriptUrl: null,
    });
  });

  it('não vaza o secret key', async () => {
    const service = await buildService(turnstileOn);

    const config = await service.publicConfig();

    expect(JSON.stringify(config)).not.toContain('secret-xyz');
    expect(config.siteKey).toBe('site-abc');
  });

  it('v3 recebe o site key embutido na URL do script', async () => {
    const service = await buildService(recaptchaOn);

    const config = await service.publicConfig();

    // Sem o ?render=<siteKey> o grecaptcha.execute nunca resolve.
    expect(config.scriptUrl).toContain('render=site-abc');
  });
});

describe('CaptchaService.listProviders', () => {
  it('lista o catálogo de providers para a tela de configuração', async () => {
    const service = await buildService({});

    const providers = service.listProviders();

    expect(providers).toContainEqual(
      expect.objectContaining({ id: 'TURNSTILE', label: expect.any(String) }),
    );
  });
});

describe('CaptchaService.validateConfiguration', () => {
  it('provider desconhecido reprova sem chamar ninguém', async () => {
    const service = await buildService({});

    const result = await service.validateConfiguration({
      provider: 'NAO_EXISTE' as never,
      secretKey: 's',
    });

    expect(result.status).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('credenciais aceitas → status true', async () => {
    const service = await buildService({});
    siteVerifyReplies({ success: true });

    const result = await service.validateConfiguration({
      provider: 'TURNSTILE',
      secretKey: 'secret-bom',
      token: 'tok-browser',
    });

    expect(result.status).toBe(true);
  });

  it('secret errada é detectada mesmo sem token do browser', async () => {
    const service = await buildService({});
    siteVerifyReplies({
      success: false,
      'error-codes': ['invalid-input-secret'],
    });

    const result = await service.validateConfiguration({
      provider: 'TURNSTILE',
      secretKey: 'secret-ruim',
    });

    expect(result.status).toBe(false);
    expect(result.data).toContain('Secret key');
  });

  it('token real recusado com secret aceita = chaves de sites diferentes', async () => {
    const service = await buildService({});
    siteVerifyReplies({
      success: false,
      'error-codes': ['invalid-input-response'],
    });

    const result = await service.validateConfiguration({
      provider: 'TURNSTILE',
      secretKey: 'secret-bom',
      token: 'tok-de-outra-sitekey',
    });

    expect(result.status).toBe(false);
    expect(result.data).toContain('mesmo site');
  });

  it('sem token, recusa do token é esperada → secret aprovada', async () => {
    const service = await buildService({});
    // A sonda manda um token falso de propósito; o provider reclama DELE, não da secret.
    siteVerifyReplies({
      success: false,
      'error-codes': ['invalid-input-response'],
    });

    const result = await service.validateConfiguration({
      provider: 'TURNSTILE',
      secretKey: 'secret-bom',
    });

    expect(result.status).toBe(true);
  });

  it('provider fora do ar REPROVA — ao contrário do verify()', async () => {
    const service = await buildService({});
    mockFetch.mockRejectedValue(new Error('network down'));

    const result = await service.validateConfiguration({
      provider: 'TURNSTILE',
      secretKey: 'secret-bom',
      token: 'tok',
    });

    // Gravar credencial que ninguém conseguiu conferir é pior que pedir de novo.
    expect(result.status).toBe(false);
  });

  it('score baixo não reprova a configuração', async () => {
    const service = await buildService({});
    siteVerifyReplies({ success: true, score: 0.1 });

    const result = await service.validateConfiguration({
      provider: 'RECAPTCHA_V3',
      secretKey: 'secret-bom',
      token: 'tok',
    });

    // Credencial certa com score baixo continua sendo credencial certa.
    expect(result.status).toBe(true);
  });
});
