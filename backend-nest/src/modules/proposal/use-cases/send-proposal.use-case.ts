import { BadRequestException, Injectable } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import { MessagingService } from '../../messaging/messaging.service';
import { ReservedVariableKey } from 'src/domain/messaging/messaging-variables.const';
import { ReservedButtonKey } from 'src/domain/messaging/messaging-buttons.const';
import { PROPOSAL_SENT_TEMPLATE_KEY } from 'src/domain/proposal/proposal-messaging.const';
import { ProposalSendChannelConst } from 'src/domain/proposal/proposalSendChannel.const';
import { PublicationStateConst } from 'src/domain/proposal/publicationState.const';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import { FindOneProposalUseCase } from './find-one.use-case';
import { BuildProposalPublicLinkUseCase } from './build-proposal-public-link.use-case';
import { derivePublicationState } from './list-proposal-versions.use-case';

export interface SendProposalInput {
  proposalId: string;
  /** Sem telefone, usa o contato principal da empresa (`Contact.isPrimary`). */
  phone?: string;
  /** Id do template a enviar; omitido usa `PROPOSAL_SENT_TEMPLATE_KEY`. */
  templateId?: string;
  /** Variáveis custom do template (além de `title` e `link`, sempre derivados da proposta). */
  values?: Record<string, string>;
  /** URL pública da imagem para header IMAGE. */
  headerImageUrl?: string;
}

export interface SendProposalOutput {
  proposalId: string;
  versionId: string;
  succeeded: boolean;
  toPhone: string;
  shortUrl: string;
}

/** Fecha o ciclo "publicou → manda": monta/reusa o link curto e envia o template `PROPOSAL_SENT` por
 * WhatsApp inline (sem fila). `trySendTemplateNow` nunca lança — canal indisponível grava
 * `ProposalSend.succeeded: false` em vez de derrubar a rota. */
@Injectable()
export class SendProposalUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly findOne: FindOneProposalUseCase,
    private readonly buildPublicLink: BuildProposalPublicLinkUseCase,
    private readonly messaging: MessagingService,
  ) {}

  async execute(
    input: SendProposalInput,
    user: AuthenticatedUser,
  ): Promise<SendProposalOutput> {
    const proposal = await this.findOne.execute(input.proposalId, user);

    const version = await this.prisma.proposalVersion.findFirst({
      where: { proposalId: input.proposalId },
      orderBy: { version: 'desc' },
    });
    if (
      !version ||
      derivePublicationState(version) !== PublicationStateConst.ACTIVE
    ) {
      throw new BadRequestException(
        this.i18n.t('proposal.send_no_active_version'),
      );
    }

    const contact = proposal.companyId
      ? await this.prisma.companyContact.findFirst({
          where: {
            companyId: proposal.companyId,
            isPrimary: true,
            archivedAt: null,
          },
          include: { messagingContact: true },
        })
      : null;
    const phone = input.phone ?? contact?.messagingContact.phone ?? undefined;
    if (!phone) {
      throw new BadRequestException(this.i18n.t('proposal.send_no_contact'));
    }

    const link = await this.buildPublicLink.execute({
      versionId: version.id,
      createdById: user.id,
    });

    const result = await this.messaging.trySendTemplateNow(
      {
        ...(input.templateId
          ? { templateId: input.templateId }
          : { key: PROPOSAL_SENT_TEMPLATE_KEY }),
        phone,
        // `title` e `link` vêm sempre da proposta; variáveis do chamador complementam (ex.: company_name).
        values: {
          title: proposal.name,
          link: link.shortUrl,
          ...(input.values ?? {}),
        },
        ...(contact?.messagingContact.name
          ? {
              reserved: {
                [ReservedVariableKey.FIRST_NAME]: contact.messagingContact.name,
              },
            }
          : {}),
        buttons: {
          open: version.publicToken as string,
          [ReservedButtonKey.OPT_OUT]: true,
        },
        headerImageUrl: input.headerImageUrl,
      },
      { correlation: { type: 'proposal', id: input.proposalId } },
    );

    await this.prisma.proposalSend.create({
      data: {
        versionId: version.id,
        channel: ProposalSendChannelConst.WHATSAPP,
        toPhone: phone,
        succeeded: !!result,
        detail:
          result?.providerMessageId ??
          this.i18n.t('proposal.send_channel_unavailable'),
        sentById: user.id,
      },
    });

    return {
      proposalId: input.proposalId,
      versionId: version.id,
      succeeded: !!result,
      toPhone: phone,
      shortUrl: link.shortUrl,
    };
  }
}
