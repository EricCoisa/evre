import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import {
  PublicationStateConst,
  type PublicationState,
} from 'src/domain/proposal/publicationState.const';
import { FindOneProposalUseCase } from './find-one.use-case';

export interface ProposalVersionWithState {
  id: string;
  proposalId: string;
  version: number;
  layout: Record<string, unknown>;
  totalCents: number | null;
  currency: string;
  recurrence: string;
  termDays: number | null;
  validUntil: Date | null;
  includedItems: string[];
  optionalItems: string[];
  publicToken: string | null;
  publishedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  state: PublicationState;
  /** `null` até o primeiro envio por WhatsApp construir o link curto — ver `BuildProposalPublicLinkUseCase`. */
  shortUrl: string | null;
}

/** Estado é sempre derivado de `publicToken`/`revokedAt`/`validUntil` — nunca uma coluna, para não
 * depender de cron para "virar" EXPIRED. */
export function derivePublicationState(version: {
  publicToken: string | null;
  revokedAt: Date | null;
  validUntil: Date | null;
}): PublicationState {
  if (version.revokedAt) return PublicationStateConst.REVOKED;
  if (!version.publicToken) return PublicationStateConst.NONE;
  if (version.validUntil && version.validUntil.getTime() < Date.now()) {
    return PublicationStateConst.EXPIRED;
  }
  return PublicationStateConst.ACTIVE;
}

@Injectable()
export class ListProposalVersionsUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly findOne: FindOneProposalUseCase,
  ) {}

  async execute(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ProposalVersionWithState[]> {
    await this.findOne.execute(id, user);

    const versions = await this.prisma.proposalVersion.findMany({
      where: { proposalId: id },
      orderBy: { version: 'desc' },
    });

    return versions.map((version) => ({
      ...(version as unknown as Omit<
        ProposalVersionWithState,
        'state' | 'shortUrl'
      >),
      layout: version.layout as Record<string, unknown>,
      state: derivePublicationState(version),
      shortUrl: version.shortUrlCode
        ? this.buildShortUrl(version.shortUrlCode)
        : null,
    }));
  }

  /** Mesma regra de base de `ShortenUrlUseCase.buildShortUrl` — só reconstrói a URL, nunca gera código. */
  private buildShortUrl(code: string): string {
    const base =
      this.configService.get<string>('SHORT_URL_BASE_URL') ||
      this.configService.get<string>('FRONTEND_URL') ||
      process.env.NEXTAUTH_URL ||
      'http://localhost:3000';
    const cleanBase = base.replace(/\/+$/, '');
    return `${cleanBase}/s/${code}`;
  }
}
