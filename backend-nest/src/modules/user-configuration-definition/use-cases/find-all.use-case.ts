import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { PaginationQuery } from '../../../common/schemas/pagination.schema';
import type { PaginatedResponse } from '../../../common/types/pagination.types';
import { UserConfigurationDefinition } from 'src/domain/user-configuration-definition/user-configuration-definition.entity';
import { convertValueByType } from 'src/common/utils/conversor.util';
import { paginate } from 'src/common/utils/paginate.util';

@Injectable()
export class FindAllUserConfigDefinitionsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    query: PaginationQuery,
  ): Promise<
    | PaginatedResponse<UserConfigurationDefinition>
    | UserConfigurationDefinition[]
  > {
    const { search } = query;

    const where = search
      ? {
          OR: [
            { labelKey: { contains: search, mode: 'insensitive' as const } },
            {
              defaultValue: { contains: search, mode: 'insensitive' as const },
            },
          ],
        }
      : {};

    return paginate(query, {
      findMany: (p) =>
        this.prisma.userConfigurationDefinition.findMany({
          where,
          orderBy: { labelKey: 'asc' },
          ...p,
        }),
      count: () => this.prisma.userConfigurationDefinition.count({ where }),
      // Antes só o caminho paginado convertia: a mesma definição vinha com
      // defaultValue tipado com `?pagination=true` e string crua sem ele.
      map: (config) => ({
        ...config,
        defaultValue:
          convertValueByType(config.defaultValue, config.valueType) ??
          config.defaultValue,
      }),
    });
  }
}
