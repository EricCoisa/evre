import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class ListCompanyInvitesUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(companyId: string) {
    const invites = await this.prisma.invite.findMany({
      where: { companyId },
      select: {
        id: true,
        email: true,
        roleId: true,
        createdById: true,
        expiresAt: true,
        usedAt: true,
        createdAt: true,
        updatedAt: true,
        actionUrl: true,
        role: { select: { name: true } },
        createdBy: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return invites.map(({ role, createdBy, ...rest }) => ({
      ...rest,
      roleName: role.name,
      createdByName: createdBy?.name ?? createdBy?.email ?? null,
    }));
  }
}
