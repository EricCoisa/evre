import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { randomBytes } from 'node:crypto';
import type { Prisma } from '@prisma/client';

const BASE62_ALPHABET =
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const PUBLIC_TOKEN_LENGTH = 16;

interface PageBlock {
  type?: string;
  props?: Record<string, unknown>;
  children?: PageBlock[];
  [key: string]: unknown;
}

interface PageLayout {
  blocks?: PageBlock[];
  [key: string]: unknown;
}

/** Publica em cascata os artefatos referenciados (bloco `iframe`, `props.artifactId`) num layout
 * antes dele ser congelado numa versão pública, e troca o id interno pelo `publicToken`
 * resolvido — chamado de dentro da transação de publish de quem possui o layout (hoje: Proposal).
 * Artifact nunca importa nada de Proposal; é essa quem importa este use-case. */
@Injectable()
export class PublishReferencedArtifactsUseCase {
  constructor(private readonly i18n: I18nService) {}

  async execute(
    layout: unknown,
    tx: Prisma.TransactionClient,
  ): Promise<unknown> {
    const cloned = structuredClone(layout) as PageLayout;
    const iframeBlocks = this.collectIframeBlocks(cloned.blocks ?? []);

    for (const block of iframeBlocks) {
      const artifactId = block.props?.artifactId;
      if (typeof artifactId !== 'string' || !artifactId) continue;

      const artifact = await tx.artifact.findUnique({
        where: { id: artifactId },
      });
      if (!artifact || artifact.archivedAt) {
        throw new BadRequestException(
          this.i18n.t('artifact.referenced_missing_or_archived'),
        );
      }

      const publicToken =
        artifact.publicToken ?? (await this.generateUniquePublicToken(tx));

      if (!artifact.published) {
        await tx.artifact.update({
          where: { id: artifact.id },
          data: { published: true, publicToken },
        });
      }

      block.props = { ...block.props, artifactId: publicToken };
    }

    return cloned;
  }

  private collectIframeBlocks(blocks: PageBlock[]): PageBlock[] {
    const found: PageBlock[] = [];
    for (const block of blocks) {
      if (block.type === 'iframe') found.push(block);
      if (Array.isArray(block.children)) {
        found.push(...this.collectIframeBlocks(block.children));
      }
    }
    return found;
  }

  private async generateUniquePublicToken(
    tx: Prisma.TransactionClient,
    maxAttempts = 5,
  ): Promise<string> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const token = this.randomBase62(PUBLIC_TOKEN_LENGTH);
      const existing = await tx.artifact.findUnique({
        where: { publicToken: token },
      });
      if (!existing) return token;
    }
    throw new ConflictException(
      this.i18n.t('artifact.public_token_generation_failed'),
    );
  }

  private randomBase62(length: number): string {
    const bytes = randomBytes(length);
    let result = '';
    for (let i = 0; i < length; i++) {
      result += BASE62_ALPHABET[bytes[i] % BASE62_ALPHABET.length];
    }
    return result;
  }
}
