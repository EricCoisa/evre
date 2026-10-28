import { GetEmailConfigTool } from './get-email-config.tool';

describe('GetEmailConfigTool', () => {
  const store: Record<string, string | null> = {};
  const mockSysConfig = {
    getValueOrNull: vi.fn((key: string) => Promise.resolve(store[key] ?? null)),
  };
  const mockHealth = { execute: vi.fn() };

  const tool = () =>
    new GetEmailConfigTool(mockSysConfig as never, mockHealth as never);

  beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(store)) delete store[k];
    mockHealth.execute.mockResolvedValue({ operational: true });
  });

  it('é somente leitura: sem approvalScope, restrita a ADMIN', () => {
    expect(tool().definition.approvalScope).toBeUndefined();
    expect(tool().definition.roles).toEqual(['ADMIN']);
  });

  it('SMTP: devolve host/porta/usuário e a senha só como presença', async () => {
    Object.assign(store, {
      SYSTEM_EMAIL_PROVIDER: 'SMTP',
      SYSTEM_EMAIL_DEFAULT_FROM: 'no-reply@app.com',
      SYSTEM_EMAIL_SMTP_HOST: 'smtp.app.com',
      SYSTEM_EMAIL_SMTP_PORT: '587',
      SYSTEM_EMAIL_SMTP_USER: 'mailer',
      SYSTEM_EMAIL_SMTP_PASS: 'senhaDoSmtpEmTextoClaro',
    });

    const result = await tool().execute();

    expect(result).toMatchObject({
      provider: 'SMTP',
      defaultFrom: 'no-reply@app.com',
      smtpHost: 'smtp.app.com',
      smtpPort: '587',
      smtpPass: 'configurado',
      health: { operational: true },
    });
    expect(JSON.stringify(result)).not.toContain('senhaDoSmtpEmTextoClaro');
  });

  it('RESEND: devolve a api key só como presença, sem campos de SMTP', async () => {
    Object.assign(store, {
      SYSTEM_EMAIL_PROVIDER: 'RESEND',
      SYSTEM_EMAIL_DEFAULT_FROM: 'no-reply@app.com',
      SYSTEM_EMAIL_PROVIDER_API_KEY: 're_chaveRealDoResend',
    });

    const result = await tool().execute();

    expect(result).toMatchObject({ provider: 'RESEND', apiKey: 'configurado' });
    expect(result).not.toHaveProperty('smtpHost');
    expect(JSON.stringify(result)).not.toContain('re_chaveRealDoResend');
  });

  it('nada configurado: provider null e credencial ausente, sem estourar', async () => {
    expect(await tool().execute()).toMatchObject({
      provider: null,
      apiKey: 'não configurado',
    });
  });

  it('email inoperante ainda devolve a config, com o motivo', async () => {
    store.SYSTEM_EMAIL_PROVIDER = 'RESEND';
    mockHealth.execute.mockResolvedValue({
      operational: false,
      reason: 'invalid api key',
    });

    expect(await tool().execute()).toMatchObject({
      health: { operational: false, reason: 'invalid api key' },
    });
  });
});
