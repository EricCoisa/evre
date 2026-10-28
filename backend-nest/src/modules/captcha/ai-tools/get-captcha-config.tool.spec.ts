import { GetCaptchaConfigTool } from './get-captcha-config.tool';

describe('GetCaptchaConfigTool', () => {
  const mockSysConfig = { getValueOrNull: vi.fn() };
  const mockCaptcha = { publicConfig: vi.fn(), listProviders: vi.fn() };

  const tool = () =>
    new GetCaptchaConfigTool(mockSysConfig as never, mockCaptcha as never);

  beforeEach(() => {
    vi.clearAllMocks();
    mockCaptcha.publicConfig.mockResolvedValue({
      enabled: true,
      provider: 'TURNSTILE',
      siteKey: '0x4AAAsiteKey',
      scriptUrl: 'https://challenges.cloudflare.com/turnstile/v0/api.js',
    });
    mockCaptcha.listProviders.mockReturnValue([
      { id: 'TURNSTILE', label: 'Cloudflare Turnstile', scriptUrl: 'a' },
      { id: 'HCAPTCHA', label: 'hCaptcha', scriptUrl: 'b' },
    ]);
    mockSysConfig.getValueOrNull.mockResolvedValue('0x4AAAsecretKeyReal');
  });

  it('é somente leitura: sem approvalScope, restrita a ADMIN', () => {
    expect(tool().definition.approvalScope).toBeUndefined();
    expect(tool().definition.roles).toEqual(['ADMIN']);
  });

  it('devolve a config pública e a secret key só como presença', async () => {
    const result = await tool().execute();

    // siteKey é público de propósito — vai ao browser de todo jeito.
    expect(result).toMatchObject({
      enabled: true,
      provider: 'TURNSTILE',
      siteKey: '0x4AAAsiteKey',
      secretKey: 'configurado',
    });
    expect(JSON.stringify(result)).not.toContain('0x4AAAsecretKeyReal');
  });

  it('inclui o catálogo de providers — é o que evita o modelo chutar o id no save', async () => {
    const result = await tool().execute();
    expect(result.availableProviders.map((p) => p.id)).toEqual([
      'TURNSTILE',
      'HCAPTCHA',
    ]);
  });

  it('secret ausente aparece como não configurada', async () => {
    mockSysConfig.getValueOrNull.mockResolvedValue(null);
    expect(await tool().execute()).toMatchObject({
      secretKey: 'não configurado',
    });
  });
});
