import { Injectable, NotFoundException } from '@nestjs/common';
import type { Artifact } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class UpdateArtifactUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(id: string, data: { name?: string }): Promise<Artifact> {
    const artifact = await this.prisma.artifact.findUnique({ where: { id } });
    if (!artifact || artifact.archivedAt) {
      throw new NotFoundException('artifact.not_found');
    }
    return this.prisma.artifact.update({
      where: { id },
      data: { name: data.name?.trim() || artifact.name },
    });
  }
}
