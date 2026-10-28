import { Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import type { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import { UserRoleConst } from 'src/domain/auth/userRole.const';

export type ResourceScope = {
  companyId?: string | null;
  projectId?: string | null;
};

export type ResourceWhere = {
  OR: Array<{ companyId: { in: string[] } } | { projectId: { in: string[] } }>;
};

/** Ponto único por onde toda leitura de recurso passa. Nega por padrão; ADMIN é o único bypass. */
@Injectable()
export class ResourceAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  /** Lança 404 (não 403, para não confirmar que o id existe) sem Membership que alcance o escopo. */
  async assertCanRead(
    user: AuthenticatedUser,
    scope: ResourceScope,
  ): Promise<void> {
    if (user.roleName === UserRoleConst.ADMIN) {
      return;
    }

    const or = this.buildScopeOr(scope);
    if (or.length === 0) {
      throw new NotFoundException(this.i18n.t('resource_access.no_scope'));
    }

    const membership = await this.prisma.membership.findFirst({
      where: { userId: user.id, OR: or },
    });
    if (!membership) {
      throw new NotFoundException(this.i18n.t('resource_access.not_found'));
    }
  }

  /** `true` só com Membership que alcance o escopo **e** `canSeeCommercials` ligada. ADMIN sempre vê. */
  async canSeeCommercials(
    user: AuthenticatedUser,
    scope: ResourceScope,
  ): Promise<boolean> {
    if (user.roleName === UserRoleConst.ADMIN) {
      return true;
    }

    const or = this.buildScopeOr(scope);
    if (or.length === 0) {
      return false;
    }

    const membership = await this.prisma.membership.findFirst({
      where: { userId: user.id, canSeeCommercials: true, OR: or },
    });
    return membership !== null;
  }

  /** Fragmento `where` restrito aos escopos do usuário; `undefined` só para ADMIN, nunca `{}`. */
  async scopeFilter(
    user: AuthenticatedUser,
  ): Promise<ResourceWhere | undefined> {
    if (user.roleName === UserRoleConst.ADMIN) {
      return undefined;
    }

    const memberships = await this.prisma.membership.findMany({
      where: { userId: user.id },
      select: { companyId: true, projectId: true },
    });

    const companyIds = memberships
      .map((m) => m.companyId)
      .filter((id): id is string => id !== null);
    const projectIds = memberships
      .map((m) => m.projectId)
      .filter((id): id is string => id !== null);

    return {
      OR: [
        { companyId: { in: companyIds } },
        { projectId: { in: projectIds } },
      ],
    };
  }

  async hasAnyMembership(userId: string): Promise<boolean> {
    const count = await this.prisma.membership.count({ where: { userId } });
    return count > 0;
  }

  /** Só os ramos do escopo com valor; escopo vazio devolve `[]` (nunca "sem filtro = tudo"). */
  private buildScopeOr(scope: ResourceScope): Prisma.MembershipWhereInput[] {
    const or: Prisma.MembershipWhereInput[] = [];
    if (scope.companyId) {
      or.push({ companyId: scope.companyId });
    }
    if (scope.projectId) {
      or.push({ projectId: scope.projectId });
    }
    return or;
  }
}
