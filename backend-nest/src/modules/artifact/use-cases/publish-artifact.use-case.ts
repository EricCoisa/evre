import { Injectable, NotFoundException } from '@nestjs/common';
import type { Artifact } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

const TOKEN_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const TOKEN_LENGTH = 16;

/** Controla o estado de publicação de um artefato. Idempotente — sem mudança retorna o mesmo registro.
 * published=false despublica (links param); public=false volta a exigir autenticação.
 * publicToken é preservado ao despublicar para reusar se republicar — evita mudar URL. */
@Injectable()
export class PublishArtifactUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    id: string,
    data: { published: boolean; public: boolean },
  ): Promise<Artifact> {
    const artifact = await this.prisma.artifact.findUnique({ where: { id } });
    if (!artifact || artifact.archivedAt) {
      throw new NotFoundException('artifact.not_found');
    }

    const noChange =
      artifact.published === data.published && artifact.public === data.public;
    if (noChange && artifact.publicToken) return artifact;

    // Gera token na 1ª publicação e reusa sempre — URL nunca muda mesmo após despublicar/republicar
    const publicToken =
      artifact.publicToken ??
      (data.published ? await this.generateToken() : null);

    return this.prisma.artifact.update({
      where: { id },
      data: {
        published: data.published,
        public: data.published && data.public,
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
