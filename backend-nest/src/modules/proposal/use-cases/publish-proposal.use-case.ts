import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';
import { randomBytes } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { LogActions } from 'src/domain/logging/log-actions';
import { ProposalStatusConst } from 'src/domain/proposal/proposalStatus.const';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import { FindOneProposalUseCase } from './find-one.use-case';
import { PublishReferencedArtifactsUseCase } from '../../artifact/use-cases/publish-referenced-artifacts.use-case';

const BASE62_ALPHABET =
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const PUBLIC_TOKEN_LENGTH = 16;

export interface PublishProposalOutput {
  proposalId: string;
  version: number;
  publicToken: string;
  publicUrl: string;
  publishedAt: Date;
  status: string;
}

/** Publicar congela: copia layout e envelope para uma `ProposalVersion`, gera o token público e
 * revoga o token da versão anterior — tudo em uma transação, para nunca existir dois links vigentes. */
@Injectable()
export class PublishProposalUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly configService: ConfigService,
    private readonly loggingService: LoggingService,
    private readonly findOne: FindOneProposalUseCase,
    private readonly publishReferencedArtifacts: PublishReferencedArtifactsUseCase,
  ) {}

  async execute(
    id: string,
    user: AuthenticatedUser,
  ): Promise<PublishProposalOutput> {
    const found = await this.findOne.execute(id, user);

    if (found.archivedAt || !found.layout) {
      throw new BadRequestException(
        this.i18n.t('proposal.cannot_publish_without_layout'),
      );
    }

    const created = await this.prisma.$transaction(async (tx) => {
      await tx.proposalVersion.updateMany({
        where: { proposalId: id, publicToken: { not: null }, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      const last = await tx.proposalVersion.findFirst({
        where: { proposalId: id },
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      const nextVersion = (last?.version ?? 0) + 1;

      const publicToken = await this.generateUniquePublicToken(tx);
      const resolvedLayout = await this.publishReferencedArtifacts.execute(
        found.layout,
        tx,
      );

      const version = await tx.proposalVersion.create({
        data: {
          proposalId: id,
          version: nextVersion,
          layout: resolvedLayout as Prisma.InputJsonValue,
          totalCents: found.totalCents,
          currency: found.currency,
          recurrence: found.recurrence,
          termDays: found.termDays,
          validUntil: found.validUntil,
          includedItems: found.includedItems,
          optionalItems: found.optionalItems,
          publicToken,
          publishedAt: new Date(),
        },
      });

      if (found.status === ProposalStatusConst.DRAFT) {
        await tx.proposal.update({
          where: { id },
          data: { status: ProposalStatusConst.SENT },
        });
      }

      return version;
    });

    await this.loggingService.create(
      {
        module: 'PROPOSAL',
        action: LogActions.CREATE,
        message: `Proposal publicada (v${created.version}): ${found.name}`,
        metadata: { proposalId: id, version: created.version },
      },
      user.id,
    );

    return {
      proposalId: id,
      version: created.version,
      publicToken: created.publicToken as string,
      publicUrl: this.buildPublicUrl(created.publicToken as string),
      publishedAt: created.publishedAt as Date,
      status:
        found.status === ProposalStatusConst.DRAFT
          ? ProposalStatusConst.SENT
          : found.status,
    };
  }

  private async generateUniquePublicToken(
    tx: Prisma.TransactionClient,
    maxAttempts = 5,
  ): Promise<string> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const token = this.randomBase62(PUBLIC_TOKEN_LENGTH);
      const existing = await tx.proposalVersion.findUnique({
        where: { publicToken: token },
        select: { id: true },
      });
      if (!existing) {
        return token;
      }
    }
    throw new ConflictException(
      this.i18n.t('proposal.public_token_generation_failed'),
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

  private buildPublicUrl(token: string): string {
    const base =
      this.configService.get<string>('FRONTEND_URL') ||
      process.env.NEXTAUTH_URL ||
      'http://localhost:3000';
    const cleanBase = base.replace(/\/+$/, '');
    return `${cleanBase}/p/${token}`;
  }
}
