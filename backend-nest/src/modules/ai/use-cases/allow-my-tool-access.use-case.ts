import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AllowMyToolAccessUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(userId: string, toolName: string) {
    await this.prisma.userToolAccess.deleteMany({
      where: { userId, toolName },
    });
    return { name: toolName, enabled: true };
  }
}
