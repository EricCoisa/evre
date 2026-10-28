import { Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';

export interface ResolvePublicProposalVersionOutput {
  id: string;
}

/** Resolve `publicToken` → id da versão, mesma chave i18n de 404 de `GetPublicProposalUseCase`.
 * Só confere existência — revogação, expiração e outra versão aceita são recusa de negócio do
 * aceite, tratadas dentro de `AcceptProposalVersionUseCase` com mensagens próprias. */
@Injectable()
export class ResolvePublicProposalVersionUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  async execute(token: string): Promise<ResolvePublicProposalVersionOutput> {
    const version = await this.prisma.proposalVersion.findUnique({
      where: { publicToken: token },
      select: { id: true },
    });

    if (!version) {
      throw new NotFoundException(this.i18n.t('proposal.public.not_found'));
    }

    return { id: version.id };
  }
}
