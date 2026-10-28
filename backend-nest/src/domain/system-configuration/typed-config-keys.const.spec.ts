import {
  secretStatus,
  typedConfigOwner,
  typedConfigRefusal,
} from './typed-config-keys.const';

describe('typedConfigOwner', () => {
  it('reconhece as chaves de storage e email por prefixo', () => {
    expect(typedConfigOwner('SYSTEM_STORAGE_PROVIDER')).toBe(
      'save_storage_config',
    );
    expect(typedConfigOwner('SYSTEM_STORAGE_S3_SECRET_KEY')).toBe(
      'save_storage_config',
    );
    expect(typedConfigOwner('SYSTEM_EMAIL_SMTP_PASS')).toBe(
      'save_email_config',
    );
    expect(typedConfigOwner('SYSTEM_EMAIL_PROVIDER_API_KEY')).toBe(
      'save_email_config',
    );
  });

  it('reconhece só as três chaves de captcha do use-case validado', () => {
    expect(typedConfigOwner('SYSTEM_CAPTCHA_PROVIDER')).toBe(
      'save_captcha_config',
    );
    expect(typedConfigOwner('SYSTEM_CAPTCHA_SITE_KEY')).toBe(
      'save_captcha_config',
    );
    expect(typedConfigOwner('SYSTEM_CAPTCHA_SECRET_KEY')).toBe(
      'save_captcha_config',
    );
  });

  it('NÃO bloqueia SYSTEM_CAPTCHA_ENABLED — é o liga/desliga, e não tem tool própria', () => {
    // Bloquear aqui tiraria do agente a capacidade de desligar o captcha sem
    // nada para pôr no lugar: o SaveCaptchaConfigUseCase também não o gerencia.
    expect(typedConfigOwner('SYSTEM_CAPTCHA_ENABLED')).toBeNull();
  });

  it('não bloqueia chaves sem tool substituta (AI, OAuth) nem chaves comuns', () => {
    // Sem tool dedicada por decisão de segurança — bloquear removeria a
    // capacidade sem alternativa.
    expect(typedConfigOwner('SYSTEM_AI_PROVIDER')).toBeNull();
    expect(typedConfigOwner('SYSTEM_OAUTH_GOOGLE_CLIENT_ID')).toBeNull();
    expect(typedConfigOwner('SYSTEM_AGENT_OWN_KEY')).toBeNull();
    expect(typedConfigOwner('QUALQUER_OUTRA')).toBeNull();
  });

  it('é indiferente a caixa e espaço — a chave chega do modelo', () => {
    expect(typedConfigOwner('  system_storage_provider  ')).toBe(
      'save_storage_config',
    );
  });

  it('chave ausente não vira bloqueio', () => {
    expect(typedConfigOwner(undefined)).toBeNull();
    expect(typedConfigOwner(null)).toBeNull();
    expect(typedConfigOwner('')).toBeNull();
  });

  it('a recusa nomeia a tool certa — é o que o modelo lê para se corrigir', () => {
    const msg = typedConfigRefusal(
      'SYSTEM_EMAIL_SMTP_PASS',
      'save_email_config',
    );
    expect(msg).toContain('SYSTEM_EMAIL_SMTP_PASS');
    expect(msg).toContain('save_email_config');
  });
});

describe('secretStatus', () => {
  it('reporta presença e NUNCA o valor', () => {
    expect(secretStatus('sk-super-secreto')).toBe('configurado');
    expect(secretStatus('sk-super-secreto')).not.toContain('sk-');
    expect(secretStatus(null)).toBe('não configurado');
    expect(secretStatus('')).toBe('não configurado');
    expect(secretStatus(undefined)).toBe('não configurado');
  });
});
