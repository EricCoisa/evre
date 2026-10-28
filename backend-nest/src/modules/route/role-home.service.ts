import { Injectable } from '@nestjs/common';
import { SystemConfigurationService } from 'src/modules/system-configuration/system-configuration.service';
import {
  ROLE_HOME_CONFIG_KEY,
  parseRoleHomeMap,
  type RoleHomeMap,
} from 'src/domain/route/role-home.const';
import { PrismaService } from 'src/prisma/prisma.service';

/** Home de cada role, em SystemConfiguration. Fonte única: não há mais coluna no banco. */
@Injectable()
export class RoleHomeService {
  constructor(
    private readonly systemConfig: SystemConfigurationService,
    private readonly prisma: PrismaService,
  ) {}

  async map(): Promise<RoleHomeMap> {
    const raw = await this.systemConfig.getValueOrNull(ROLE_HOME_CONFIG_KEY);
    return parseRoleHomeMap(raw);
  }

  async routeIdFor(
    roleName: string | null | undefined,
  ): Promise<string | null> {
    if (!roleName) return null;
    return (await this.map())[roleName] ?? null;
  }

  /** Grava o mapa, descartando entrada cuja rota não exista ou que a role não alcance. */
  async save(next: RoleHomeMap, performedById: string): Promise<RoleHomeMap> {
    const roleNames = Object.keys(next);
    const grants = roleNames.length
      ? await this.prisma.roleRouteAccess.findMany({
          where: {
            role: { name: { in: roleNames } },
            routeId: { in: [...new Set(Object.values(next))] },
          },
          select: { routeId: true, role: { select: { name: true } } },
        })
      : [];

    const allowed = new Set(
      grants.map((grant) => `${grant.role.name}::${grant.routeId}`),
    );

    const cleaned: RoleHomeMap = {};
    for (const [role, routeId] of Object.entries(next)) {
      if (allowed.has(`${role}::${routeId}`)) cleaned[role] = routeId;
    }

    await this.systemConfig.setManyByLabelKey(
      [
        {
          labelKey: ROLE_HOME_CONFIG_KEY,
          value: JSON.stringify(cleaned),
          valueType: 'JSON',
        },
      ],
      performedById,
    );
    return cleaned;
  }
}
