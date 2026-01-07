import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { I18nContext } from 'nestjs-i18n';
import { Request } from 'express';
import type { AuthenticatedUser } from '../types/auth.types';
import { UserRole } from 'src/domain/auth/userRole.const';

interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const i18n = I18nContext.current(context);

    if (!request.user) {
      throw new ForbiddenException(
        i18n?.t('common.errors.unauthorized') ?? 'Usuário não autenticado',
      );
    }

    const hasRole = requiredRoles.some((role) => request.user.role === role);

    if (!hasRole) {
      throw new ForbiddenException(
        i18n?.t('common.errors.forbidden', {
          args: { roles: requiredRoles.join(', ') },
        }) ?? `Acesso negado. Roles necessárias: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
