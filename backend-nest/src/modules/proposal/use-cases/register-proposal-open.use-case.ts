import { Injectable } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationService } from '../../notification/notification.service';
import { ProposalNotificationType } from 'src/domain/proposal/proposal-notification-types.const';

export interface RegisterProposalOpenInput {
  token: string;
  ip?: string;
  userAgent?: string;
}

/** Grava a abertura da página pública sempre; notifica o dono só na primeira abertura daquela
 * versão — conta os eventos antes de gravar, na mesma transação, para não notificar duas vezes
 * em aberturas concorrentes. Notificar a cada abertura transformaria o sinal em ruído. */
@Injectable()
export class RegisterProposalOpenUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly i18n: I18nService,
  ) {}

  async execute({
    token,
    ip,
    userAgent,
  }: RegisterProposalOpenInput): Promise<void> {
    const version = await this.prisma.proposalVersion.findUnique({
      where: { publicToken: token },
      select: {
        id: true,
        proposal: { select: { id: true, ownerId: true, name: true } },
      },
    });

    // Chamado só depois de `GetPublicProposalUseCase` já ter resolvido o token com sucesso —
    // `null` aqui é só uma corrida rara (ex.: revogação entre as duas chamadas).
    if (!version) return;

    const isFirstOpen = await this.prisma.$transaction(async (tx) => {
      const priorOpens = await tx.proposalOpenEvent.count({
        where: { versionId: version.id },
      });
      await tx.proposalOpenEvent.create({
        data: { versionId: version.id, ip, userAgent },
      });
      return priorOpens === 0;
    });

    if (!isFirstOpen) return;

    await this.notificationService.notify({
      type: ProposalNotificationType.OPENED,
      recipients: { userIds: [version.proposal.ownerId] },
      titleKey: 'proposal.public.opened_title',
      title: this.i18n.t('proposal.public.opened_title'),
      messageKey: 'proposal.public.opened_message',
      message: this.i18n.t('proposal.public.opened_message', {
        args: { name: version.proposal.name },
      }),
      actionUrl: `/proposal/${version.proposal.id}?tab=publicacao`,
      channels: { whatsapp: true },
    });
  }
}
