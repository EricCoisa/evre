import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  ServiceUnavailableException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { I18nService } from 'nestjs-i18n';
import { CaptchaService } from './captcha.service';
import { CAPTCHA_TOKEN_HEADER } from '../../domain/auth/captcha.const';

export const CAPTCHA_KEY = 'require_captcha';

/** Exige token de captcha válido na rota quando o captcha está configurado e habilitado. */
export const RequireCaptcha = () => SetMetadata(CAPTCHA_KEY, true);

@Injectable()
export class CaptchaGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly captcha: CaptchaService,
    private readonly i18n: I18nService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<boolean | undefined>(
      CAPTCHA_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers[CAPTCHA_TOKEN_HEADER];
    const token = Array.isArray(header) ? header[0] : header;

    // Mesmo IP que o ThrottlerGuard rastreia — só existe porque o front repassa
    // o X-Forwarded-For (ver lib/api/client-ip.ts). O siteverify usa como sinal.
    const remoteIp = request.ips?.length ? request.ips[0] : request.ip;

    const result = await this.captcha.verify(token, remoteIp);
    if (result.ok) return true;

    if (result.reason === 'unavailable') {
      throw new ServiceUnavailableException(
        this.i18n.t('auth.captcha.unavailable'),
      );
    }

    throw new ForbiddenException(
      this.i18n.t(
        result.reason === 'missing_token'
          ? 'auth.captcha.required'
          : 'auth.captcha.failed',
      ),
    );
  }
}
