import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

const RESERVED_ROLE_NAMES = ['ADMIN', 'USER'] as const;

@Injectable()
export class CreateRoleUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(name: string) {
    if (
      RESERVED_ROLE_NAMES.includes(name as (typeof RESERVED_ROLE_NAMES)[number])
    ) {
      throw new BadRequestException(
        `Role name "${name}" is reserved for system use`,
      );
    }
    const existing = await this.prisma.role.findUnique({ where: { name } });
    if (existing) throw new ConflictException(`Role "${name}" already exists`);
    return this.prisma.role.create({ data: { name } });
  }
}
