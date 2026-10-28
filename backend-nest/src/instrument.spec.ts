import * as Sentry from '@sentry/nestjs';
import { disableSentry, initSentry } from './instrument';

vi.mock('@sentry/nestjs', () => ({ init: vi.fn(), getClient: vi.fn() }));

describe('initSentry', () => {
  beforeEach(() => {
    // O módulo chama `initSentry(process.env.SENTRY_DSN)` ao ser importado —
    // limpar aqui torna esse efeito irrelevante para os casos abaixo.
    vi.mocked(Sentry.init).mockClear();
    vi.mocked(Sentry.getClient).mockReturnValue(undefined);
  });

  it.each([undefined, null, '', '   '])('não liga sem DSN (%p)', (dsn) => {
    expect(initSentry(dsn)).toBe(false);
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it('liga com o DSN informado', () => {
    expect(initSentry('  https://k@sentry.io/1  ')).toBe(true);
    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({ dsn: 'https://k@sentry.io/1' }),
    );
  });

  it('não reinicializa quando já existe cliente (env ganha do banco)', () => {
    vi.mocked(Sentry.getClient).mockReturnValue(
      {} as ReturnType<typeof Sentry.getClient>,
    );
    expect(initSentry('https://k@sentry.io/2')).toBe(false);
    expect(Sentry.init).not.toHaveBeenCalled();
  });
});

describe('disableSentry', () => {
  beforeEach(() => vi.mocked(Sentry.getClient).mockReturnValue(undefined));

  it('fecha o cliente ligado pelo ambiente — é o que dá alcance ao toggle', async () => {
    const close = vi.fn().mockResolvedValue(true);
    vi.mocked(Sentry.getClient).mockReturnValue({
      close,
    } as unknown as ReturnType<typeof Sentry.getClient>);

    expect(await disableSentry()).toBe(true);
    expect(close).toHaveBeenCalled();
  });

  it('não faz nada quando o SDK nunca ligou', async () => {
    expect(await disableSentry()).toBe(false);
  });
});
