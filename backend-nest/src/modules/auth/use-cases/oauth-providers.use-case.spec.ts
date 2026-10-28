import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { OauthProvidersUseCase } from './oauth-providers.use-case';
import { SystemConfigurationService } from '../../system-configuration/system-configuration.service';
import { OAuthProviders } from '../../../domain/auth/oauthProvider.const';

const mockSysConfig = { findByLabelKey: vi.fn() };

/** Responde às chaves listadas; qualquer outra se comporta como ausente no banco. */
const configuredKeys = (values: Record<string, string | boolean>) => {
  mockSysConfig.findByLabelKey.mockImplementation((labelKey: string) => {
    if (labelKey in values) return Promise.resolve({ value: values[labelKey] });
    return Promise.reject(new NotFoundException());
  });
};

const GOOGLE_FULL = {
  SYSTEM_OAUTH_GOOGLE_ISSUER: 'https://accounts.google.com',
  SYSTEM_OAUTH_GOOGLE_CLIENT_ID: 'client-123',
  SYSTEM_OAUTH_GOOGLE_CLIENT_SECRET: 'secret-456',
};

describe('OauthProvidersUseCase', () => {
  let useCase: OauthProvidersUseCase;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        OauthProvidersUseCase,
        { provide: SystemConfigurationService, useValue: mockSysConfig },
      ],
    }).compile();
    useCase = mod.get(OauthProvidersUseCase);
    vi.clearAllMocks();
  });

  it('lista todos os providers registrados, configurados ou não', async () => {
    configuredKeys(GOOGLE_FULL);

    const result = await useCase.list();

    expect(result).toHaveLength(OAuthProviders.length);
    expect(result).toEqual(
      expect.arrayContaining([
        { id: 'GOOGLE', label: 'Google', configured: true, enabled: true },
        { id: 'MICROSOFT', label: 'Microsoft', configured: false, enabled: true },
      ]),
    );
  });

  it('enabled=false quando a chave SYSTEM_OAUTH_<ID>_ENABLED está false', async () => {
    configuredKeys({ ...GOOGLE_FULL, SYSTEM_OAUTH_GOOGLE_ENABLED: false });

    const result = await useCase.list();

    expect(result.find((p) => p.id === 'GOOGLE')?.enabled).toBe(false);
  });

  it('enabled=true por padrão quando a chave nunca foi semeada', async () => {
    configuredKeys(GOOGLE_FULL);

    const result = await useCase.list();

    expect(result.every((p) => p.enabled)).toBe(true);
  });

  it('nunca devolve credencial no resumo', async () => {
    configuredKeys(GOOGLE_FULL);

    const result = await useCase.list();

    expect(JSON.stringify(result)).not.toContain('secret-456');
    expect(JSON.stringify(result)).not.toContain('client-123');
  });

  it.each([
    'SYSTEM_OAUTH_GOOGLE_ISSUER',
    'SYSTEM_OAUTH_GOOGLE_CLIENT_ID',
    'SYSTEM_OAUTH_GOOGLE_CLIENT_SECRET',
  ])('marca configured=false quando %s está vazia', async (missingKey) => {
    configuredKeys({ ...GOOGLE_FULL, [missingKey]: '   ' });

    const result = await useCase.list();

    expect(result.find((p) => p.id === 'GOOGLE')?.configured).toBe(false);
  });

  it('trata chave ausente no banco como não configurado', async () => {
    configuredKeys({});

    const result = await useCase.list();

    expect(result.every((p) => !p.configured)).toBe(true);
  });

  it('getConfiguredOrThrow devolve a credencial completa', async () => {
    configuredKeys(GOOGLE_FULL);

    await expect(useCase.getConfiguredOrThrow('GOOGLE')).resolves.toEqual({
      id: 'GOOGLE',
      label: 'Google',
      issuer: 'https://accounts.google.com',
      clientId: 'client-123',
      clientSecret: 'secret-456',
    });
  });

  it.each([
    ['MICROSOFT', 'provider sem credencial'],
    ['NAO_EXISTE', 'provider fora do registro'],
  ])('getConfiguredOrThrow lança 404 para %s (%s)', async (id) => {
    configuredKeys(GOOGLE_FULL);

    await expect(useCase.getConfiguredOrThrow(id)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('getConfiguredOrThrow lança 404 quando o provider está desativado', async () => {
    configuredKeys({ ...GOOGLE_FULL, SYSTEM_OAUTH_GOOGLE_ENABLED: false });

    await expect(useCase.getConfiguredOrThrow('GOOGLE')).rejects.toThrow(
      NotFoundException,
    );
  });
});
