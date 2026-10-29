import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import { ShortUrlService } from '../../short-url/short-url.service';

export interface BuildProposalPublicLinkInput {
  versionId: string;
  createdById?: string | null;
}

export interface BuildProposalPublicLinkOutput {
  code: string;
  shortUrl: string;
}

/** Encurta `<FRONTEND_URL>/p/<publicToken>` da versão e guarda o código em `shortUrlCode` — idempotente:
 * versão que já tem código reusa, nunca gera um `ShortLink` novo a cada envio. `ShortLink` aqui é só
 * encurtador; quem autoriza o acesso continua sendo `publicToken` (decisão de F1-01). */
@Injectable()
export class BuildProposalPublicLinkUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shortUrl: ShortUrlService,
    private readonly configService: ConfigService,
    private readonly i18n: I18nService,
  ) {}

  async execute(
    input: BuildProposalPublicLinkInput,
  ): Promise<BuildProposalPublicLinkOutput> {
    const version = await this.prisma.proposalVersion.findUnique({
      where: { id: input.versionId },
      select: { publicToken: true, shortUrlCode: true, validUntil: true },
    });
    if (!version?.publicToken) {
      throw new BadRequestException(
        this.i18n.t('proposal.send_no_active_version'),
      );
    }

    if (version.shortUrlCode) {
      return {
        code: version.shortUrlCode,
        shortUrl: this.shortUrl.buildShortUrl(version.shortUrlCode),
      };
    }

    const shortened = await this.shortUrl.shorten({
      targetUrl: this.buildPublicUrl(version.publicToken),
      purpose: 'proposal',
      expiresAt: version.validUntil ?? undefined,
      createdById: input.createdById ?? null,
    });

    await this.prisma.proposalVersion.update({
      where: { id: input.versionId },
      data: { shortUrlCode: shortened.code },
    });

    return { code: shortened.code, shortUrl: shortened.shortUrl };
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
