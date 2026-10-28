import { of } from 'rxjs';
import type { ExecutionContext, CallHandler } from '@nestjs/common';
import { LoggingInterceptor } from './logging.interceptor';

const makeContext = (method = 'GET', url = '/test', statusCode = 200) =>
  ({
    switchToHttp: vi.fn().mockReturnValue({
      getRequest: vi.fn().mockReturnValue({ method, url }),
      getResponse: vi.fn().mockReturnValue({ statusCode }),
    }),
  }) as unknown as ExecutionContext;

const makeNext = (value: unknown = {}): CallHandler => ({
  handle: vi.fn().mockReturnValue(of(value)),
});

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;

  beforeEach(() => {
    interceptor = new LoggingInterceptor();
  });

  afterEach(() => vi.clearAllMocks());

  it('returns an observable that emits the original value', async () => {
    const ctx = makeContext();
    const next = makeNext({ data: 'ok' });

    await new Promise<void>((resolve) => {
      interceptor.intercept(ctx, next).subscribe({
        next: (value) => {
          expect(value).toEqual({ data: 'ok' });
        },
        complete: resolve,
      });
    });
  });

  it('logs method, url, status code and elapsed time on completion', async () => {
    const logSpy = vi
      .spyOn((interceptor as any).logger, 'log')
      .mockImplementation(() => undefined);
    const ctx = makeContext('POST', '/api/users', 201);
    const next = makeNext('created');

    await new Promise<void>((resolve) => {
      interceptor.intercept(ctx, next).subscribe({ complete: resolve });
    });

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringMatching(/POST \/api\/users 201 - \d+ms/),
    );
  });
});
