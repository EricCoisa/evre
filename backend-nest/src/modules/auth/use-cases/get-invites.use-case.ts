import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class GetInvitesUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute() {
    const invites = await this.prisma.invite.findMany({
      select: {
        id: true,
        email: true,
        roleId: true,
        createdById: true,
        expiresAt: true,
        usedAt: true,
        createdAt: true,
        updatedAt: true,
        role: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return invites.map(({ role, ...rest }) => ({
      ...rest,
      actionUrl: null,
      roleName: role.name,
    }));
  }
}
