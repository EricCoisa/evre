import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { PaginationQuery } from '../../../common/schemas/pagination.schema';
import type { PaginatedResponse } from '../../../common/types/pagination.types';
import { paginate } from '../../../common/utils/paginate.util';
import type { User } from 'src/domain/user/user.entity';
import { UserStatus, UserStatusConst } from 'src/domain/auth/userStatus.const';
import { UserRoleConst } from 'src/domain/auth/userRole.const';

@Injectable()
export class FindAllUsersUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    query: PaginationQuery,
  ): Promise<PaginatedResponse<User> | User[]> {
    const { search, filter } = query;

    const where: {
      deletedAt?: null;
      OR?: Array<{
        email?: { contains: string };
        name?: { contains: string };
      }>;
      roleRecord?: { name: string };
      status?: UserStatus;
    } = { deletedAt: null };

    if (search) {
      where.OR = [
        { email: { contains: search } },
        { name: { contains: search } },
      ];
    }

    if (filter?.role) {
      where.roleRecord = { name: filter.role };
    }

    if (filter?.status) {
      where.status = filter.status as UserStatus;
    }

    const select = {
      id: true,
      email: true,
      name: true,
      roleRecord: { select: { name: true } },
      status: true,
      createdAt: true,
      updatedAt: true,
    };

    const mapUser = (u: {
      roleRecord: { name: string } | null;
      [k: string]: unknown;
    }) => {
      const { roleRecord, ...rest } = u;
      return { ...rest, role: roleRecord?.name ?? '' };
    };

    return paginate(query, {
      findMany: (p) =>
        this.prisma.user.findMany({
          where,
          select,
          orderBy: { createdAt: 'desc' },
          ...p,
        }),
      count: () => this.prisma.user.count({ where }),
      map: (u) => mapUser(u) as unknown as User,
      extra: {
        filter: {
          role: Object.values(UserRoleConst),
          status: Object.values(UserStatusConst),
        },
      },
    });
  }
}
