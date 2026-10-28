import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class DeleteInviteUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(id: string) {
    const invite = await this.prisma.invite.findUnique({ where: { id } });
    if (!invite) throw new NotFoundException('Invite not found');
    await this.prisma.invite.delete({ where: { id } });
  }
}
