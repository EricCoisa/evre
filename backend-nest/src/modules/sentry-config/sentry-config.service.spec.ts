import { SentryConfigService } from './sentry-config.service';
import { parseSentryDsn } from '../../domain/observability/sentry.const';

const DSN = 'https://abc123@o0.ingest.sentry.io/1234567';

describe('parseSentryDsn', () => {
  it('extrai chave, projeto e monta o endpoint de ingestão', () => {
    expect(parseSentryDsn(DSN)).toEqual({
      publicKey: 'abc123',
      projectId: '1234567',
      envelopeUrl:
        'https://o0.ingest.sentry.io/api/1234567/envelope/?sentry_key=abc123&sentry_version=7',
    });
  });

  it('preserva o subpath de self-hosted servido em subpasta', () => {
    expect(
      parseSentryDsn('https://k@sentry.acme.dev/prefixo/42'),
    ).toMatchObject({
      projectId: '42',
      envelopeUrl:
        'https://sentry.acme.dev/prefixo/api/42/envelope/?sentry_key=k&sentry_version=7',
    });
  });

  it.each([
    ['texto solto', 'não-é-url'],
    ['sem chave pública', 'https://o0.ingest.sentry.io/1234567'],
    ['sem id de projeto', 'https://abc123@o0.ingest.sentry.io'],
    ['projeto não-numérico', 'https://abc123@o0.ingest.sentry.io/projeto'],
    ['protocolo inválido', 'ftp://abc123@o0.ingest.sentry.io/1'],
  ])('recusa %s', (_label, dsn) => {
    expect(parseSentryDsn(dsn)).toBeNull();
  });
});

describe('SentryConfigService.validateDsn', () => {
  let service: SentryConfigService;
  const fetchMock = vi.fn();

  beforeEach(() => {
    service = new SentryConfigService();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('reprova formato inválido antes de ir à rede', async () => {
    const result = await service.validateDsn('nada disso');

    expect(result.status).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sonda o endpoint de ingestão do próprio DSN', async () => {
    fetchMock.mockResolvedValue({ status: 400 });

    await service.validateDsn(DSN);

    expect(fetchMock).toHaveBeenCalledWith(
      parseSentryDsn(DSN)!.envelopeUrl,
      expect.objectContaining({ method: 'POST' }),
    );
  });

  // 400 é o "empty envelope" esperado: o corpo vazio já passou pela autenticação,
  // que é exatamente o que a sonda quer provar — sem criar evento no projeto.
  it.each([200, 400, 429])('aceita HTTP %i', async (status) => {
    fetchMock.mockResolvedValue({ status });

    expect((await service.validateDsn(DSN)).status).toBe(true);
  });

  it.each([401, 403, 404])('reprova HTTP %i', async (status) => {
    fetchMock.mockResolvedValue({ status });

    expect((await service.validateDsn(DSN)).status).toBe(false);
  });

  it('reprova quando o host não responde', async () => {
    fetchMock.mockRejectedValue(new Error('getaddrinfo ENOTFOUND'));

    const result = await service.validateDsn(DSN);

    expect(result.status).toBe(false);
    expect(result.data).toContain('ENOTFOUND');
  });

  it('rejeição que não é Error ainda vira uma mensagem', async () => {
    fetchMock.mockRejectedValue('network unreachable');

    const result = await service.validateDsn(DSN);

    expect(result.status).toBe(false);
    expect(result.data).toContain('network unreachable');
  });
});
