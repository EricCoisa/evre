import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ToolRegistry } from '../tool-registry.service';

@Injectable()
export class RevokeMyToolAccessUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly toolRegistry: ToolRegistry,
  ) {}

  async execute(userId: string, toolName: string) {
    if (!this.toolRegistry.hasTool(toolName)) {
      throw new NotFoundException(`Tool ${toolName} não encontrada`);
    }
    await this.prisma.userToolAccess.upsert({
      where: { userId_toolName: { userId, toolName } },
      update: {},
      create: { userId, toolName },
    });
    return { name: toolName, enabled: false };
  }
}
