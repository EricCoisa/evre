import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { PaginationQuery } from '../../../common/schemas/pagination.schema';
import type { PaginatedResponse } from '../../../common/types/pagination.types';
import { UserRoleDto } from '../dto/user-role.dto';

@Injectable()
export class FindAllUserRoleUseCase {
  constructor(private readonly prisma: PrismaService) {}

  // Returns system roles from DB; was previously reading from enum const
  async execute(
    query: PaginationQuery,
  ): Promise<PaginatedResponse<UserRoleDto> | UserRoleDto[]> {
    const { page, limit, pagination } = query;

    const allRoles = await this.prisma.role.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    const allRoleDtos: UserRoleDto[] = allRoles.map((r) => ({
      roleId: r.id,
      roleName: r.name,
    }));

    if (!pagination) {
      return allRoleDtos;
    }

    const skip = (page - 1) * limit;
    const paginatedRoles = allRoleDtos.slice(skip, skip + limit);

    return {
      data: paginatedRoles,
      meta: {
        page,
        limit,
        total: allRoleDtos.length,
        totalPages: Math.ceil(allRoleDtos.length / limit),
      },
    };
  }
}
