import { GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import { PublicationStateConst } from 'src/domain/proposal/publicationState.const';
import { derivePublicationState } from './list-proposal-versions.use-case';

export interface GetPublicProposalEnvelope {
  totalCents: number | null;
  currency: string;
  recurrence: string;
  termDays: number | null;
  validUntil: Date | null;
  includedItems: string[];
  optionalItems: string[];
}

export interface GetPublicProposalOutput {
  proposalName: string;
  companyName: string | null;
  layout: Record<string, unknown>;
  envelope: GetPublicProposalEnvelope;
  /** `null` quando ainda não aceita — a tela pública decide mostrar o formulário ou o estado
   * aceito a partir deste campo, sem nome/email/ip/userAgent de quem aceitou. */
  acceptedAt: Date | null;
}

/** Resolve o `publicToken` e devolve só o que a tela pública renderiza. Nunca `ownerId`,
 * `lostReason`, nota interna nem id de proposta/empresa — a base de segurança é o profile
 * `proposal` (`dataSources: 'none'`), que já impede qualquer bloco de buscar dado autenticado. */
@Injectable()
export class GetPublicProposalUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  async execute(token: string): Promise<GetPublicProposalOutput> {
    const version = await this.prisma.proposalVersion.findUnique({
      where: { publicToken: token },
      select: {
        publicToken: true,
        revokedAt: true,
        validUntil: true,
        layout: true,
        totalCents: true,
        currency: true,
        recurrence: true,
        termDays: true,
        includedItems: true,
        optionalItems: true,
        acceptedAt: true,
        // `select` em vez de `include`: só o que é seguro existir em memória chega aqui —
        // nunca `ownerId`, `lostReason` nem id de proposta/empresa.
        proposal: {
          select: { name: true, company: { select: { name: true } } },
        },
      },
    });

    if (!version) {
      throw new NotFoundException(this.i18n.t('proposal.public.not_found'));
    }

    const state = derivePublicationState(version);

    if (state === PublicationStateConst.REVOKED) {
      throw new GoneException({
        message: this.i18n.t('proposal.public.revoked'),
        errors: { reason: PublicationStateConst.REVOKED },
      });
    }

    if (state === PublicationStateConst.EXPIRED) {
      throw new GoneException({
        message: this.i18n.t('proposal.public.expired'),
        errors: { reason: PublicationStateConst.EXPIRED },
      });
    }

    return {
      proposalName: version.proposal.name,
      companyName: version.proposal.company?.name ?? null,
      layout: version.layout as Record<string, unknown>,
      acceptedAt: version.acceptedAt,
      envelope: {
        totalCents: version.totalCents,
        currency: version.currency,
        recurrence: version.recurrence,
        termDays: version.termDays,
        validUntil: version.validUntil,
        includedItems: version.includedItems,
        optionalItems: version.optionalItems,
      },
    };
  }
}
