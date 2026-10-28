import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class GetSystemRolesUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(): Promise<{ value: string; label: string }[]> {
    const roles = await this.prisma.role.findMany({
      where: { isSystem: true },
      select: { id: true, name: true },
    });
    return roles.map((r) => ({ value: r.id, label: r.name }));
  }
}
