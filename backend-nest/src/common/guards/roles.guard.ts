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
import { UserRole, UserRoleConst } from 'src/domain/auth/userRole.const';
import { CheckAccessUseCase } from 'src/modules/user-route-access/use-cases/check-access.use-case';

interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private readonly checkAccess: CheckAccessUseCase,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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

    const hasRole = requiredRoles.some(
      (role) => request.user.roleName === role,
    );

    if (!hasRole) {
      throw new ForbiddenException(
        i18n?.t('common.errors.forbidden', {
          args: { roles: requiredRoles.join(', ') },
        }) ?? `Acesso negado. Roles necessárias: ${requiredRoles.join(', ')}`,
      );
    }

    if (request.user.roleName !== UserRoleConst.ADMIN) {
      const controllerPath = this.reflector.get<string>(
        'path',
        context.getClass(),
      );
      const routePath = controllerPath ? `/${controllerPath}` : null;
      if (routePath) {
        const allowed = await this.checkAccess.execute(
          request.user.id,
          routePath,
          request.user.roleId,
        );
        if (!allowed) {
          throw new ForbiddenException(
            i18n?.t('common.errors.forbidden', {
              args: { roles: requiredRoles.join(', ') },
            }) ?? 'Acesso negado.',
          );
        }
      }
    }

    return true;
  }
}
