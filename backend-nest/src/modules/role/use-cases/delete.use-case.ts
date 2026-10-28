import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class DeleteRoleUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(id: string) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException(`Role ${id} not found`);
    if (role.isSystem)
      throw new ForbiddenException('Cannot delete system roles');
    return this.prisma.role.delete({ where: { id } });
  }
}
