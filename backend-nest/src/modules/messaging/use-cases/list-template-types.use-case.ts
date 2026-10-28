import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import type { PaginationQuery } from 'src/common/schemas/pagination.schema';
import type { PaginatedResponse } from 'src/common/types/pagination.types';
import { paginate } from 'src/common/utils/paginate.util';
import type { MessagingTemplateTypeDto } from '../dto/messaging-template-type.dto';

@Injectable()
export class ListTemplateTypesUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    query: PaginationQuery,
  ): Promise<
    PaginatedResponse<MessagingTemplateTypeDto> | MessagingTemplateTypeDto[]
  > {
    const { search } = query;

    const where = search
      ? {
          OR: [{ key: { contains: search } }, { name: { contains: search } }],
        }
      : {};

    return paginate(query, {
      findMany: (p) =>
        this.prisma.messagingTemplateType.findMany({
          where: search ? where : undefined,
          orderBy: { key: 'asc' },
          include: { _count: { select: { templates: true } } },
          ...p,
        }),
      count: () =>
        search
          ? this.prisma.messagingTemplateType.count({ where })
          : this.prisma.messagingTemplateType.count(),
      // `templatesCount` deixa a tela bloquear a exclusão e avisar antes de mexer num tipo em uso.
      map: ({ _count, ...row }) =>
        ({
          ...row,
          templatesCount: _count.templates,
        }) as unknown as MessagingTemplateTypeDto,
    });
  }
}
