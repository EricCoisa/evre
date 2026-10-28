import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CaptchaGuard, CAPTCHA_KEY } from './captcha.guard';
import type { CaptchaService } from './captcha.service';
import { CAPTCHA_TOKEN_HEADER } from '../../domain/auth/captcha.const';

const i18n = { t: (key: string) => key } as never;

function contextWith(headers: Record<string, unknown> = {}, ips: string[] = []) {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({
      getRequest: () => ({ headers, ips, ip: '10.0.0.1' }),
    }),
  } as unknown as ExecutionContext;
}

/** Reflector que diz se a rota tem (ou não) `@RequireCaptcha()`. */
function reflectorSaying(required: boolean | undefined) {
  return { getAllAndOverride: () => required } as unknown as Reflector;
}

describe('CaptchaGuard', () => {
  it('rota sem @RequireCaptcha() nem consulta o serviço', async () => {
    const verify = vi.fn();
    const guard = new CaptchaGuard(
      reflectorSaying(undefined),
      { verify } as unknown as CaptchaService,
      i18n,
    );

    await expect(guard.canActivate(contextWith())).resolves.toBe(true);
    expect(verify).not.toHaveBeenCalled();
  });

  it('token válido libera', async () => {
    const verify = vi.fn().mockResolvedValue({ ok: true });
    const guard = new CaptchaGuard(
      reflectorSaying(true),
      { verify } as unknown as CaptchaService,
      i18n,
    );

    const ctx = contextWith({ [CAPTCHA_TOKEN_HEADER]: 'tok-1' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('usa o IP do cliente (ips[0]), não o do último salto', async () => {
    const verify = vi.fn().mockResolvedValue({ ok: true });
    const guard = new CaptchaGuard(
      reflectorSaying(true),
      { verify } as unknown as CaptchaService,
      i18n,
    );

    const ctx = contextWith({ [CAPTCHA_TOKEN_HEADER]: 'tok-1' }, [
      '203.0.113.7',
      'proxy1',
    ]);
    await guard.canActivate(ctx);

    expect(verify).toHaveBeenCalledWith('tok-1', '203.0.113.7');
  });

  it('sem X-Forwarded-For cai no IP do socket', async () => {
    const verify = vi.fn().mockResolvedValue({ ok: true });
    const guard = new CaptchaGuard(
      reflectorSaying(true),
      { verify } as unknown as CaptchaService,
      i18n,
    );

    await guard.canActivate(contextWith({ [CAPTCHA_TOKEN_HEADER]: 'tok-1' }));

    expect(verify).toHaveBeenCalledWith('tok-1', '10.0.0.1');
  });

  it('token ausente → mensagem de "resolva o captcha"', async () => {
    const guard = new CaptchaGuard(
      reflectorSaying(true),
      {
        verify: vi.fn().mockResolvedValue({ ok: false, reason: 'missing_token' }),
      } as unknown as CaptchaService,
      i18n,
    );

    await expect(guard.canActivate(contextWith())).rejects.toThrow(
      new ForbiddenException('auth.captcha.required'),
    );
  });

  it('token recusado → mensagem de falha na verificação', async () => {
    const guard = new CaptchaGuard(
      reflectorSaying(true),
      {
        verify: vi.fn().mockResolvedValue({ ok: false, reason: 'rejected' }),
      } as unknown as CaptchaService,
      i18n,
    );

    const ctx = contextWith({ [CAPTCHA_TOKEN_HEADER]: 'tok-ruim' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(
      new ForbiddenException('auth.captcha.failed'),
    );
  });

  it('header repetido usa a primeira ocorrência', async () => {
    const verify = vi.fn().mockResolvedValue({ ok: true });
    const guard = new CaptchaGuard(
      reflectorSaying(true),
      { verify } as unknown as CaptchaService,
      i18n,
    );

    const ctx = contextWith({ [CAPTCHA_TOKEN_HEADER]: ['tok-1', 'tok-2'] });
    await guard.canActivate(ctx);

    expect(verify).toHaveBeenCalledWith('tok-1', '10.0.0.1');
  });
});

it('CAPTCHA_KEY é a chave de metadata do @RequireCaptcha()', () => {
  expect(CAPTCHA_KEY).toBe('require_captcha');
});
