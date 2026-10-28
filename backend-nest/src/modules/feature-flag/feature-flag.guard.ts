import {
  Injectable,
  CanActivate,
  ExecutionContext,
  NotFoundException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import type { AuthenticatedUser } from '../../common/types/auth.types';
import { FeatureFlagService } from './feature-flag.service';

export const FEATURE_KEY = 'feature_flag';

/** @RequireFeature('MY_FLAG') — 404 se desabilitada (não vaza existência) */
export const RequireFeature = (key: string) => SetMetadata(FEATURE_KEY, key);

interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly featureFlagService: FeatureFlagService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const key = this.reflector.getAllAndOverride<string | undefined>(
      FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!key) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const roleName = request.user?.roleName ?? '';

    const enabled = await this.featureFlagService.isEnabled(key, roleName);
    if (!enabled) throw new NotFoundException();

    return true;
  }
}
