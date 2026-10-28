import {
  BadRequestException,
  ConflictException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { NotificationService } from '../../notification/notification.service';
import { LogActions } from 'src/domain/logging/log-actions';
import { ProposalStatusConst } from 'src/domain/proposal/proposalStatus.const';
import {
  ProposalAcceptanceSourceConst,
  type ProposalAcceptanceSourceValue,
} from 'src/domain/proposal/proposalAcceptanceSource.const';
import { ProposalNotificationType } from 'src/domain/proposal/proposal-notification-types.const';

export interface AcceptProposalVersionInput {
  versionId: string;
  source: ProposalAcceptanceSourceValue;
  name?: string;
  email?: string;
  note?: string;
  ip?: string;
  userAgent?: string;
  /** Quem registrou no OFFLINE — vai para o `SystemLog`, nunca na própria versão (ela guarda a
   * decisão do cliente, não a identidade de quem digitou). */
  acceptedById?: string | null;
}

export interface AcceptProposalVersionOutput {
  proposalId: string;
  versionId: string;
  acceptedAt: Date;
  alreadyAccepted: boolean;
}

/** Use-case único das duas portas de aceite (link público e registro offline). Idempotente por
 * leitura dentro da transação — nunca `catch` de unique constraint: a decisão já tomada é lida e
 * a escrita usa `acceptedAt: null` como guarda, então duplo clique e retry de rede nunca gravam
 * uma segunda vez. Aceite é sinal, não gatilho — só notifica o dono; nada de empresa, contrato ou
 * projeto nasce aqui. */
@Injectable()
export class AcceptProposalVersionUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly loggingService: LoggingService,
    private readonly notificationService: NotificationService,
  ) {}

  async execute(
    input: AcceptProposalVersionInput,
  ): Promise<AcceptProposalVersionOutput> {
    if (input.source === ProposalAcceptanceSourceConst.OFFLINE && !input.note) {
      throw new BadRequestException(
        this.i18n.t('proposal.acceptance_note_required'),
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const version = await tx.proposalVersion.findUnique({
        where: { id: input.versionId },
        select: {
          id: true,
          proposalId: true,
          acceptedAt: true,
          revokedAt: true,
          validUntil: true,
          proposal: { select: { ownerId: true, name: true } },
        },
      });

      if (!version) {
        throw new NotFoundException(this.i18n.t('proposal.version_not_found'));
      }

      if (version.revokedAt) {
        throw new GoneException(this.i18n.t('proposal.acceptance_revoked'));
      }

      if (version.validUntil && version.validUntil.getTime() < Date.now()) {
        throw new GoneException(this.i18n.t('proposal.acceptance_expired'));
      }

      const otherAccepted = await tx.proposalVersion.findFirst({
        where: {
          proposalId: version.proposalId,
          id: { not: version.id },
          acceptedAt: { not: null },
        },
        select: { id: true },
      });
      if (otherAccepted) {
        throw new ConflictException(
          this.i18n.t('proposal.acceptance_other_version_accepted'),
        );
      }

      const ownerId = version.proposal.ownerId;
      const proposalName = version.proposal.name;

      // Idempotência: a versão já tinha sido aceita (duplo clique/retry) — devolve sucesso sem
      // gravar nada de novo.
      if (version.acceptedAt) {
        return {
          proposalId: version.proposalId,
          versionId: version.id,
          acceptedAt: version.acceptedAt,
          ownerId,
          proposalName,
          alreadyAccepted: true,
        };
      }

      const acceptedAt = new Date();
      // `acceptedAt: null` na condição é a guarda: se outra transação já tiver aceitado entre a
      // leitura acima e esta escrita, o update não casa nenhuma linha.
      const written = await tx.proposalVersion.updateMany({
        where: { id: version.id, acceptedAt: null },
        data: {
          acceptedAt,
          acceptedByName: input.name ?? null,
          acceptedByEmail: input.email ?? null,
          acceptanceSource: input.source,
          acceptanceNote: input.note ?? null,
          acceptanceIp: input.ip ?? null,
          acceptanceAgent: input.userAgent ?? null,
        },
      });

      if (written.count === 0) {
        const current = await tx.proposalVersion.findUniqueOrThrow({
          where: { id: version.id },
          select: { acceptedAt: true },
        });
        return {
          proposalId: version.proposalId,
          versionId: version.id,
          acceptedAt: current.acceptedAt as Date,
          ownerId,
          proposalName,
          alreadyAccepted: true,
        };
      }

      await tx.proposal.update({
        where: { id: version.proposalId },
        data: { status: ProposalStatusConst.ACCEPTED },
      });

      return {
        proposalId: version.proposalId,
        versionId: version.id,
        acceptedAt,
        ownerId,
        proposalName,
        alreadyAccepted: false,
      };
    });

    if (!result.alreadyAccepted) {
      if (input.source === ProposalAcceptanceSourceConst.OFFLINE) {
        await this.loggingService.create(
          {
            module: 'PROPOSAL',
            action: LogActions.UPDATE,
            message: `Aceite registrado manualmente: ${result.proposalName}`,
            metadata: {
              proposalId: result.proposalId,
              versionId: result.versionId,
              source: input.source,
            },
          },
          input.acceptedById ?? null,
        );
      }

      await this.notificationService.notify({
        type: ProposalNotificationType.ACCEPTED,
        recipients: { userIds: [result.ownerId] },
        titleKey: 'proposal.acceptance_notified_title',
        title: this.i18n.t('proposal.acceptance_notified_title'),
        messageKey: 'proposal.acceptance_notified_message',
        message: this.i18n.t('proposal.acceptance_notified_message', {
          args: { name: result.proposalName },
        }),
        actionUrl: `/proposal/${result.proposalId}?tab=publicacao`,
        channels: { whatsapp: true },
      });
    }

    return {
      proposalId: result.proposalId,
      versionId: result.versionId,
      acceptedAt: result.acceptedAt,
      alreadyAccepted: result.alreadyAccepted,
    };
  }
}
