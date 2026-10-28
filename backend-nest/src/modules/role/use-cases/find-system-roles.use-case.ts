import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class FindSystemRolesUseCase {
  constructor(private readonly prisma: PrismaService) {}

  execute() {
    return this.prisma.role.findMany({
      where: { isSystem: true },
      orderBy: { name: 'asc' },
    });
  }
}
