import { Injectable, NotFoundException } from '@nestjs/common';
import type { Artifact } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

const TOKEN_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const TOKEN_LENGTH = 16;

/** Publica um artefato existente: define `published: true` e gera `publicToken` único quando ausente.
 * Idempotente — já publicado devolve o mesmo registro. */
@Injectable()
export class PublishArtifactUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(id: string, isPublic = false): Promise<Artifact> {
    const artifact = await this.prisma.artifact.findUnique({ where: { id } });
    if (!artifact || artifact.archivedAt) {
      throw new NotFoundException('artifact.not_found');
    }
    const alreadyDone =
      artifact.published &&
      artifact.publicToken &&
      (!isPublic || artifact.public);
    if (alreadyDone) return artifact;

    const publicToken = artifact.publicToken ?? (await this.generateToken());
    return this.prisma.artifact.update({
      where: { id },
      data: {
        published: true,
        public: isPublic || artifact.public,
        publicToken,
      },
    });
  }

  private async generateToken(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const token = Array.from(
        { length: TOKEN_LENGTH },
        () => TOKEN_CHARS[Math.floor(Math.random() * TOKEN_CHARS.length)],
      ).join('');
      const existing = await this.prisma.artifact.findUnique({
        where: { publicToken: token },
      });
      if (!existing) return token;
    }
    throw new Error('Failed to generate unique public token');
  }
}
