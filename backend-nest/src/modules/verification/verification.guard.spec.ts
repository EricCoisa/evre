import { HttpStatus, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  VerificationGuard,
  REQUIRE_VERIFICATION_KEY,
  VerificationRequiredException,
  VerificationChannelUnavailableException,
  type RequireVerificationOptions,
} from './verification.guard';
import type { VerificationService } from './verification.service';
import type { CheckChannelHealthUseCase } from './use-cases/check-channel-health.use-case';

const healthyChannel = {
  execute: vi.fn().mockResolvedValue({ operational: true }),
} as unknown as CheckChannelHealthUseCase;

function contextWith(body: Record<string, unknown> = {}, userId = 'u1') {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({
      getRequest: () => ({ body, user: { id: userId } }),
    }),
  } as unknown as ExecutionContext;
}

function reflectorSaying(opts: RequireVerificationOptions | undefined) {
  return { getAllAndOverride: () => opts } as unknown as Reflector;
}

const OPTS: RequireVerificationOptions = {
  purpose: 'USER_PHONE_CONFIRMATION',
  channel: 'WHATSAPP',
  targetField: 'phone',
};

describe('VerificationGuard', () => {
  it('rota sem @RequireVerification() nem consulta o VerificationService', async () => {
    const isConfirmed = vi.fn();
    const guard = new VerificationGuard(
      reflectorSaying(undefined),
      { isConfirmed } as unknown as VerificationService,
      healthyChannel,
    );

    await expect(guard.canActivate(contextWith({ phone: 'x' }))).resolves.toBe(
      true,
    );
    expect(isConfirmed).not.toHaveBeenCalled();
  });

  it('campo alvo ausente no body passa sem consultar — nada está mudando', async () => {
    const isConfirmed = vi.fn();
    const guard = new VerificationGuard(
      reflectorSaying(OPTS),
      { isConfirmed } as unknown as VerificationService,
      healthyChannel,
    );

    await expect(
      guard.canActivate(contextWith({ name: 'Nova Pessoa' })),
    ).resolves.toBe(true);
    expect(isConfirmed).not.toHaveBeenCalled();
  });

  it('existe uma confirmação para o valor exato: libera', async () => {
    const isConfirmed = vi.fn().mockResolvedValue(true);
    const guard = new VerificationGuard(
      reflectorSaying(OPTS),
      { isConfirmed } as unknown as VerificationService,
      healthyChannel,
    );

    await expect(
      guard.canActivate(contextWith({ phone: '+5511999998888' })),
    ).resolves.toBe(true);
    expect(isConfirmed).toHaveBeenCalledWith({
      userId: 'u1',
      purpose: 'USER_PHONE_CONFIRMATION',
      target: '+5511999998888',
    });
  });

  it('sem confirmação para o valor: lança 428 com {purpose,channel,target}', async () => {
    const isConfirmed = vi.fn().mockResolvedValue(false);
    const guard = new VerificationGuard(
      reflectorSaying(OPTS),
      { isConfirmed } as unknown as VerificationService,
      healthyChannel,
    );

    const promise = guard.canActivate(contextWith({ phone: '+5511999998888' }));
    await expect(promise).rejects.toThrow(VerificationRequiredException);
    await promise.catch((err: VerificationRequiredException) => {
      expect(err.getStatus()).toBe(HttpStatus.PRECONDITION_REQUIRED);
      expect(err.getResponse()).toMatchObject({
        errors: {
          purpose: 'USER_PHONE_CONFIRMATION',
          channel: 'WHATSAPP',
          target: '+5511999998888',
        },
      });
    });
  });

  it('uma confirmação para um valor diferente não libera outro valor', async () => {
    const isConfirmed = vi.fn().mockResolvedValue(false);
    const guard = new VerificationGuard(
      reflectorSaying(OPTS),
      { isConfirmed } as unknown as VerificationService,
      healthyChannel,
    );

    await expect(
      guard.canActivate(contextWith({ phone: '+5511888887777' })),
    ).rejects.toThrow(VerificationRequiredException);
    expect(isConfirmed).toHaveBeenCalledWith(
      expect.objectContaining({ target: '+5511888887777' }),
    );
  });

  it('canal fora do ar: nega o recurso em vez de pedir confirmação (503, não 428)', async () => {
    const isConfirmed = vi.fn().mockResolvedValue(false);
    const unhealthyChannel = {
      execute: vi.fn().mockResolvedValue({
        operational: false,
        reason: 'verification.whatsapp_unavailable',
      }),
    } as unknown as CheckChannelHealthUseCase;
    const guard = new VerificationGuard(
      reflectorSaying(OPTS),
      { isConfirmed } as unknown as VerificationService,
      unhealthyChannel,
    );

    const promise = guard.canActivate(contextWith({ phone: '+5511999998888' }));
    await expect(promise).rejects.toThrow(VerificationChannelUnavailableException);
    await promise.catch((err: VerificationChannelUnavailableException) => {
      expect(err.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      expect(err.getResponse()).toMatchObject({
        message: 'verification.whatsapp_unavailable',
        errors: { purpose: 'USER_PHONE_CONFIRMATION', channel: 'WHATSAPP' },
      });
    });
    expect(unhealthyChannel.execute).toHaveBeenCalledWith('WHATSAPP');
  });

  it('canal fora do ar não é checado quando já existe confirmação — não há o que negar', async () => {
    const isConfirmed = vi.fn().mockResolvedValue(true);
    const unhealthyChannel = {
      execute: vi.fn().mockResolvedValue({ operational: false }),
    } as unknown as CheckChannelHealthUseCase;
    const guard = new VerificationGuard(
      reflectorSaying(OPTS),
      { isConfirmed } as unknown as VerificationService,
      unhealthyChannel,
    );

    await expect(
      guard.canActivate(contextWith({ phone: '+5511999998888' })),
    ).resolves.toBe(true);
    expect(unhealthyChannel.execute).not.toHaveBeenCalled();
  });
});

it('REQUIRE_VERIFICATION_KEY é a chave de metadata do @RequireVerification()', () => {
  expect(REQUIRE_VERIFICATION_KEY).toBe('require_verification');
});
