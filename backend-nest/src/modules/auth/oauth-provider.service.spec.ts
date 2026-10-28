import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { OAuthProviderService } from './oauth-provider.service';

vi.mock('axios');

const cfg = {
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  clientId: 'client-123',
  clientSecret: 'secret-456',
};

function httpError(status: number, data: unknown) {
  return Object.assign(new Error('Request failed'), {
    isAxiosError: true,
    response: { status, data },
  });
}

describe('OAuthProviderService', () => {
  let service: OAuthProviderService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(axios.isAxiosError).mockImplementation(
      (e: unknown) => (e as { isAxiosError?: boolean })?.isAxiosError === true,
    );
    service = new OAuthProviderService({
      get: () => 'https://app.exemplo.com',
    } as unknown as ConfigService);
  });

  it('invalid_grant (Google/Microsoft, code falso): credencial aceita', async () => {
    vi.mocked(axios.post).mockRejectedValue(
      httpError(400, { error: 'invalid_grant' }),
    );

    await expect(
      service.use(cfg).validateConfiguration(),
    ).resolves.toMatchObject({ status: true });
  });

  it('invalid_client (secret errado no Google): credencial recusada', async () => {
    vi.mocked(axios.post).mockRejectedValue(
      httpError(401, {
        error: 'invalid_client',
        error_description: 'Unauthorized',
      }),
    );

    await expect(service.use(cfg).validateConfiguration()).resolves.toEqual({
      status: false,
      data: 'Unauthorized',
    });
  });

  it('unauthorized_client (app não encontrado no Microsoft): credencial recusada', async () => {
    vi.mocked(axios.post).mockRejectedValue(
      httpError(400, {
        error: 'unauthorized_client',
        error_description: 'AADSTS700016: Application not found',
      }),
    );

    await expect(
      service.use(cfg).validateConfiguration(),
    ).resolves.toMatchObject({ status: false });
  });

  it('2xx inesperado para um code falso: credencial aceita', async () => {
    vi.mocked(axios.post).mockResolvedValue({ status: 200, data: {} });

    await expect(
      service.use(cfg).validateConfiguration(),
    ).resolves.toEqual({ status: true, data: 'Credenciais válidas' });
  });

  it('erro de client sem error_description: cai na mensagem genérica', async () => {
    vi.mocked(axios.post).mockRejectedValue(
      httpError(400, { error: 'invalid_client' }),
    );

    await expect(service.use(cfg).validateConfiguration()).resolves.toEqual({
      status: false,
      data: 'Client ID ou Client Secret recusados pelo provider',
    });
  });

  it('token endpoint inacessível: falha com a mensagem de rede', async () => {
    vi.mocked(axios.post).mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await service.use(cfg).validateConfiguration();
    expect(result.status).toBe(false);
    expect(result.data).toContain('ECONNREFUSED');
  });

  it('manda client_id/client_secret e o redirect_uri do front no corpo', async () => {
    vi.mocked(axios.post).mockRejectedValue(
      httpError(400, { error: 'invalid_grant' }),
    );

    await service.use(cfg).validateConfiguration();

    const body = vi.mocked(axios.post).mock.calls[0][1] as URLSearchParams;
    expect(vi.mocked(axios.post).mock.calls[0][0]).toBe(cfg.tokenEndpoint);
    expect(body.get('client_id')).toBe('client-123');
    expect(body.get('client_secret')).toBe('secret-456');
    expect(body.get('redirect_uri')).toBe(
      'https://app.exemplo.com/api/auth/oauth/callback',
    );
  });
});
