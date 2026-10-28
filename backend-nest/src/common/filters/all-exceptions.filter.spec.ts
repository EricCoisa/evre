import { HttpException, HttpStatus } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { I18nContext } from 'nestjs-i18n';
import { AllExceptionsFilter } from './all-exceptions.filter';

vi.mock('@sentry/nestjs', () => ({ captureException: vi.fn() }));

vi.mock('nestjs-i18n', async () => {
  const actual =
    await vi.importActual<typeof import('nestjs-i18n')>('nestjs-i18n');
  return { ...actual, I18nContext: { current: vi.fn() } };
});

const makeHost = (response: unknown) =>
  ({
    switchToHttp: vi.fn().mockReturnValue({
      getResponse: vi.fn().mockReturnValue(response),
      getRequest: vi.fn().mockReturnValue({ method: 'GET', url: '/test' }),
    }),
  }) as unknown as ArgumentsHost;

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let res: { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
  const mockI18n = { t: vi.fn((k: string) => k) };

  /** Corpo que o filtro escreveu na resposta. */
  const body = () => res.json.mock.calls[0][0] as Record<string, unknown>;
  const run = (exception: unknown) => filter.catch(exception, makeHost(res));

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    vi.mocked(I18nContext.current).mockReturnValue(mockI18n as never);
  });

  afterEach(() => vi.clearAllMocks());

  it('sempre responde no mesmo envelope, com message string', () => {
    run(new HttpException('Recurso não encontrado', 404));
    expect(res.status).toHaveBeenCalledWith(404);
    expect(body()).toEqual({
      statusCode: 404,
      timestamp: expect.any(String),
      path: '/test',
      message: 'Recurso não encontrado',
    });
  });

  it('não vaza detalhe interno de erro não-HTTP', () => {
    run(new Error('connect ECONNREFUSED 10.0.0.1:5432'));
    expect(res.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(body().message).toBe('common.errors.internal_server');
  });

  it('usa fallback quando não há contexto i18n', () => {
    vi.mocked(I18nContext.current).mockReturnValue(undefined);
    run(new Error('crash'));
    expect(body().message).toBe('Internal server error');
  });

  it('achata a resposta-objeto da HttpException numa string', () => {
    run(new HttpException({ statusCode: 403, message: 'Acesso negado' }, 403));
    expect(body().message).toBe('Acesso negado');
  });

  it('traduz quando a mensagem é uma chave i18n', () => {
    run(new HttpException('common.errors.forbidden', 403));
    expect(mockI18n.t).toHaveBeenCalledWith('common.errors.forbidden');
  });

  it('não confunde frase com ponto final com chave i18n', () => {
    run(new HttpException('Porta 587 usa STARTTLS. Use 465 para TLS.', 400));
    expect(mockI18n.t).not.toHaveBeenCalled();
    expect(body().message).toBe('Porta 587 usa STARTTLS. Use 465 para TLS.');
  });

  it('junta array de mensagens e hasteia `errors` da validação', () => {
    run(
      new HttpException(
        {
          statusCode: 400,
          message: 'Validation failed',
          errors: [{ path: 'email', message: 'Required' }],
        },
        400,
      ),
    );
    expect(body().message).toBe('Validation failed');
    expect(body().errors).toEqual([{ path: 'email', message: 'Required' }]);
  });

  it('junta múltiplas mensagens numa linha só', () => {
    run(new HttpException({ message: ['email inválido', 'senha curta'] }, 422));
    expect(body().message).toBe('email inválido; senha curta');
  });

  it('desembrulha array serializado em JSON, juntando os itens', () => {
    run(new HttpException(JSON.stringify(['erro 1', 'erro 2']), 400));
    expect(body().message).toBe('erro 1; erro 2');
  });

  it('objeto JSON sem message/error reconhecível devolve o texto como veio', () => {
    const raw = JSON.stringify({ foo: 'bar' });
    run(new HttpException(raw, 400));
    expect(body().message).toBe(raw);
  });

  it('desembrulha mensagem que veio serializada em JSON', () => {
    run(
      new HttpException(
        '{"message":"getaddrinfo ENOTFOUND smtp.example.com"}',
        400,
      ),
    );
    expect(body().message).toBe('getaddrinfo ENOTFOUND smtp.example.com');
  });

  it('não engasga com string que só parece JSON', () => {
    run(new HttpException('{isto não é json}', 400));
    expect(body().message).toBe('{isto não é json}');
  });

  it('aceita exceção que não é Error', () => {
    run('boom');
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('reporta 5xx ao Sentry', () => {
    const boom = new Error('db down');
    run(boom);
    expect(Sentry.captureException).toHaveBeenCalledWith(boom);
  });

  it('não reporta 4xx ao Sentry — é fluxo normal do cliente', () => {
    run(new HttpException('Não encontrado', 404));
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});
