import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { VerificationChannel } from '@prisma/client';
import type { AuthenticatedUser } from '../../common/types/auth.types';
import { VerificationService } from './verification.service';
import { VerificationMethod } from './verification-method.enum';
import { CheckChannelHealthUseCase } from './use-cases/check-channel-health.use-case';

export { VerificationMethod };

export const REQUIRE_VERIFICATION_KEY = 'require_verification';

export interface RequireVerificationOptions {
  /** Chave TS do módulo dono (ex. UserVerificationPurpose.PHONE_CONFIRMATION). */
  purpose: string;
  channel: VerificationChannel;
  /** Nome do campo no body da requisição cujo valor precisa já ter sido confirmado. */
  targetField: string;
  /** Validade da confirmação — ver VerificationMethod. Default: PERMANENT. */
  method?: VerificationMethod;
  /** Obrigatório quando `method: VerificationMethod.TTL`. */
  ttlSeconds?: number;
}

/** @RequireVerification bloqueia até existir um VerificationCode confirmado para o valor submetido. */
export const RequireVerification = (opts: RequireVerificationOptions) => {
  if (opts.method === VerificationMethod.TTL && !opts.ttlSeconds) {
    throw new Error(
      '@RequireVerification: ttlSeconds é obrigatório quando method = TTL',
    );
  }
  return SetMetadata(REQUIRE_VERIFICATION_KEY, opts);
};

/** 428 (Precondition Required): o sinal para o front vem em errors, não em campos soltos. */
export class VerificationRequiredException extends HttpException {
  constructor(payload: {
    purpose: string;
    channel: VerificationChannel;
    target: string;
  }) {
    super(
      { message: 'verification.required', errors: payload },
      HttpStatus.PRECONDITION_REQUIRED,
    );
  }
}

/** 503: o canal não vai conseguir entregar o código, diferente do 428 que pede confirmação. */
export class VerificationChannelUnavailableException extends HttpException {
  constructor(payload: {
    purpose: string;
    channel: VerificationChannel;
    reason?: string;
  }) {
    super(
      {
        message: payload.reason ?? 'verification.channel_unavailable',
        errors: payload,
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

interface RequestWithUser extends Request {
  user: AuthenticatedUser;
  body: Record<string, unknown>;
}

@Injectable()
export class VerificationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly verification: VerificationService,
    private readonly checkChannelHealth: CheckChannelHealthUseCase,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const opts = this.reflector.getAllAndOverride<
      RequireVerificationOptions | undefined
    >(REQUIRE_VERIFICATION_KEY, [context.getHandler(), context.getClass()]);
    if (!opts) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const target = request.body?.[opts.targetField];
    // Campo não está sendo alterado nesta chamada — nada para o guard checar.
    if (typeof target !== 'string' || target.length === 0) return true;

    const confirmed = await this.verification.isConfirmed({
      userId: request.user.id,
      purpose: opts.purpose,
      target,
      method: opts.method,
      ttlSeconds: opts.ttlSeconds,
    });
    if (confirmed) return true;

    // Não adianta pedir um código que o canal não vai conseguir entregar — nega o recurso em vez
    // de abrir o modal de verificação pra ele falhar no primeiro "enviar código".
    const health = await this.checkChannelHealth.execute(opts.channel);
    if (!health.operational) {
      throw new VerificationChannelUnavailableException({
        purpose: opts.purpose,
        channel: opts.channel,
        reason: health.reason,
      });
    }

    throw new VerificationRequiredException({
      purpose: opts.purpose,
      channel: opts.channel,
      target,
    });
  }
}
