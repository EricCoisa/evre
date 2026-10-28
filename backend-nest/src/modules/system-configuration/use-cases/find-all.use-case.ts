import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { PaginationQuery } from '../../../common/schemas/pagination.schema';
import type { PaginatedResponse } from '../../../common/types/pagination.types';
import { SystemConfiguration } from 'src/domain/system-configuration/system-configuration.entity';
import { convertValueByType } from 'src/common/utils/conversor.util';
import { CryptoService } from '../../../common/infrastructure/crypto/crypto.service';
import { paginate } from 'src/common/utils/paginate.util';
import { CapabilityRegistry } from '../../capability/capability.registry';
import {
  resolveRequirements,
  type RequirementsResult,
} from '../../capability/resolve-requirements.util';

type ConfigWithRequirements = SystemConfiguration & {
  requirements?: RequirementsResult;
};

@Injectable()
export class FindAllSystemConfigurationUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
    private readonly capabilities: CapabilityRegistry,
  ) {}

  // Rota é ADMIN-only: `viewer.roleName` é sempre 'ADMIN', então `reason` sai completo.
  async execute(
    query: PaginationQuery,
    viewer: { roleName: string },
  ): Promise<
    PaginatedResponse<ConfigWithRequirements> | ConfigWithRequirements[]
  > {
    const { search } = query;

    const where = search
      ? {
          OR: [
            { labelKey: { contains: search, mode: 'insensitive' as const } },
            { value: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    // Resolvido uma vez por request, nunca por linha — o join com cada config é em memória.
    const capabilityMap = await this.capabilities.resolveAll(viewer.roleName);

    return paginate(query, {
      findMany: (p) =>
        this.prisma.systemConfiguration.findMany({
          where,
          orderBy: { labelKey: 'asc' },
          ...p,
        }),
      count: () => this.prisma.systemConfiguration.count({ where }),
      map: (config) => {
        const rawValue = config.secret
          ? this.cryptoService.tryDecrypt(config.value)
          : config.value;
        const requirements = resolveRequirements(
          config.labelKey,
          this.capabilities,
          capabilityMap,
          viewer.roleName,
        );
        return {
          ...config,
          value: convertValueByType(rawValue, config.valueType) ?? rawValue,
          ...(requirements ? { requirements } : {}),
        };
      },
    });
  }
}
