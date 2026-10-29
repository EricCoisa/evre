import { Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import { FindOneProposalUseCase } from './find-one.use-case';

export interface ResolveCurrentProposalVersionOutput {
  id: string;
}

/** Resolve a versão vigente (a mais recente) de uma proposta para o caminho interno autenticado.
 * `FindOneProposalUseCase` garante a autorização antes da busca; recusa por revogada/expirada é do
 * aceite (`AcceptProposalVersionUseCase`), não desta resolução — mesma divisão de responsabilidade
 * do caminho público em `ResolvePublicProposalVersionUseCase`. */
@Injectable()
export class ResolveCurrentProposalVersionUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly findOne: FindOneProposalUseCase,
  ) {}

  async execute(
    proposalId: string,
    user: AuthenticatedUser,
  ): Promise<ResolveCurrentProposalVersionOutput> {
    await this.findOne.execute(proposalId, user);

    const version = await this.prisma.proposalVersion.findFirst({
      where: { proposalId },
      orderBy: { version: 'desc' },
      select: { id: true },
    });

    if (!version) {
      throw new NotFoundException(this.i18n.t('proposal.version_not_found'));
    }

    return { id: version.id };
  }
}
