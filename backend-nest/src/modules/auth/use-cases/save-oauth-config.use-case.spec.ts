import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SaveOauthConfigUseCase } from './save-oauth-config.use-case';
import { SystemConfigurationService } from '../../system-configuration/system-configuration.service';
import { OidcDiscoveryService } from '../oidc-discovery.service';
import { OAuthProviderService } from '../oauth-provider.service';
import type { SaveOauthConfigDto } from '../dto/oauth.dto';

const mockSysConfig = {
  keepStoredWhenBlank: vi.fn(),
  setManyByLabelKey: vi.fn(),
};
const mockDiscovery = { discover: vi.fn() };
const mockValidate = vi.fn();
const mockOauthProvider = {
  use: vi.fn(() => ({ validateConfiguration: mockValidate })),
};

const dto = {
  issuer: 'https://accounts.google.com',
  clientId: 'client-123',
  clientSecret: 'secret-456',
} as SaveOauthConfigDto;

describe('SaveOauthConfigUseCase', () => {
  let useCase: SaveOauthConfigUseCase;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        SaveOauthConfigUseCase,
        { provide: SystemConfigurationService, useValue: mockSysConfig },
        { provide: OidcDiscoveryService, useValue: mockDiscovery },
        { provide: OAuthProviderService, useValue: mockOauthProvider },
      ],
    }).compile();
    useCase = mod.get(SaveOauthConfigUseCase);
    vi.clearAllMocks();
    mockSysConfig.keepStoredWhenBlank.mockImplementation((value: string) =>
      Promise.resolve(value ?? ''),
    );
    mockOauthProvider.use.mockReturnValue({
      validateConfiguration: mockValidate,
    });
    mockValidate.mockResolvedValue({ status: true, data: 'Credenciais válidas' });
  });

  it('provider desconhecido: 404 e nada é gravado', async () => {
    await expect(useCase.execute('OKTA', dto, 'admin-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(mockSysConfig.setManyByLabelKey).not.toHaveBeenCalled();
  });

  it('issuer que não responde: erro do discovery sobe e nada é gravado', async () => {
    mockDiscovery.discover.mockRejectedValue(
      new ServiceUnavailableException('OIDC discovery falhou'),
    );

    await expect(useCase.execute('GOOGLE', dto, 'admin-1')).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(mockSysConfig.setManyByLabelKey).not.toHaveBeenCalled();
  });

  it('sem secret novo e sem secret guardado: 400 antes de bater no issuer', async () => {
    mockSysConfig.keepStoredWhenBlank.mockResolvedValue('');

    await expect(
      useCase.execute('GOOGLE', { ...dto, clientSecret: '' }, 'admin-1'),
    ).rejects.toThrow(BadRequestException);
    expect(mockDiscovery.discover).not.toHaveBeenCalled();
    expect(mockSysConfig.setManyByLabelKey).not.toHaveBeenCalled();
  });

  it('credenciais recusadas pelo provider: 400 e nada é gravado', async () => {
    mockDiscovery.discover.mockResolvedValue({
      authorizationEndpoint: 'https://a',
      tokenEndpoint: 'https://t',
    });
    mockValidate.mockResolvedValue({
      status: false,
      data: 'Client ID ou Client Secret recusados pelo provider',
    });

    await expect(useCase.execute('GOOGLE', dto, 'admin-1')).rejects.toThrow(
      BadRequestException,
    );
    expect(mockSysConfig.setManyByLabelKey).not.toHaveBeenCalled();
  });

  it('issuer válido: grava as 3 chaves do provider, secret marcado como secreto', async () => {
    mockDiscovery.discover.mockResolvedValue({
      authorizationEndpoint: 'https://a',
      tokenEndpoint: 'https://t',
    });

    const result = await useCase.execute('GOOGLE', dto, 'admin-1');

    expect(result.status).toBe(true);
    const entries = mockSysConfig.setManyByLabelKey.mock.calls[0][0] as Array<{
      labelKey: string;
      value: string;
      secret?: boolean;
    }>;
    expect(entries.map((e) => e.labelKey)).toEqual([
      'SYSTEM_OAUTH_GOOGLE_ISSUER',
      'SYSTEM_OAUTH_GOOGLE_CLIENT_ID',
      'SYSTEM_OAUTH_GOOGLE_CLIENT_SECRET',
    ]);
    expect(
      entries.find((e) => e.labelKey === 'SYSTEM_OAUTH_GOOGLE_CLIENT_SECRET')
        ?.secret,
    ).toBe(true);
    expect(mockOauthProvider.use).toHaveBeenCalledWith({
      tokenEndpoint: 'https://t',
      clientId: 'client-123',
      clientSecret: 'secret-456',
    });
  });

  it('secret em branco: mantém o guardado em vez de apagar a credencial', async () => {
    mockSysConfig.keepStoredWhenBlank.mockResolvedValue('secret-guardado');
    mockDiscovery.discover.mockResolvedValue({
      authorizationEndpoint: 'https://a',
      tokenEndpoint: 'https://t',
    });

    await useCase.execute('GOOGLE', { ...dto, clientSecret: '' }, 'admin-1');

    const entries = mockSysConfig.setManyByLabelKey.mock.calls[0][0] as Array<{
      labelKey: string;
      value: string;
    }>;
    expect(
      entries.find((e) => e.labelKey === 'SYSTEM_OAUTH_GOOGLE_CLIENT_SECRET')
        ?.value,
    ).toBe('secret-guardado');
  });
});
