import { Injectable } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../common/infrastructure/redis/redis.service';
import { NotificationService } from '../../notification/notification.service';
import { ProposalNotificationType } from 'src/domain/proposal/proposal-notification-types.const';

/** Janela mínima entre dois pedidos de renovação para o mesmo token — mesmo mecanismo de
 * `request-password-reset.use-case.ts` (setnx com TTL, falha aberta sem Redis). */
const RENEW_REQUEST_COOLDOWN_SECONDS = 300;

/** Não cria nem muda nada — só dispara `notify` ao dono. Idempotente por janela de tempo e
 * silencioso em token inválido/inexistente, para não virar oráculo de enumeração de token. */
@Injectable()
export class RequestProposalRenewalUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly notificationService: NotificationService,
    private readonly i18n: I18nService,
  ) {}

  async execute(token: string): Promise<void> {
    const version = await this.prisma.proposalVersion.findUnique({
      where: { publicToken: token },
      select: {
        proposal: { select: { id: true, ownerId: true, name: true } },
      },
    });

    if (!version) return;

    const firstInWindow = await this.redis.setnx(
      `proposal:renew-request:${token}`,
      '1',
      RENEW_REQUEST_COOLDOWN_SECONDS,
    );

    if (!firstInWindow) return;

    await this.notificationService.notify({
      type: ProposalNotificationType.RENEWAL_REQUESTED,
      recipients: { userIds: [version.proposal.ownerId] },
      titleKey: 'proposal.public.renew_requested_title',
      title: this.i18n.t('proposal.public.renew_requested_title'),
      messageKey: 'proposal.public.renew_requested_message',
      message: this.i18n.t('proposal.public.renew_requested_message', {
        args: { name: version.proposal.name },
      }),
      actionUrl: `/proposal/${version.proposal.id}?tab=publicacao`,
      channels: { whatsapp: true },
    });
  }
}
