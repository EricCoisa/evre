import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import { CryptoService } from 'src/common/infrastructure/crypto/crypto.service';
import { ResourceAccessService } from 'src/common/infrastructure/resource-access/resource-access.service';
import { NotificationService } from '../../notification/notification.service';
import { ProjectNotificationType } from 'src/domain/project/project-notification-types.const';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import type { AnswerInfoRequestDto } from '../dto/answer-info-request.dto';

@Injectable()
export class AnswerInfoRequestUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly crypto: CryptoService,
    private readonly resourceAccess: ResourceAccessService,
    private readonly notifications: NotificationService,
  ) {}

  async execute(
    projectId: string,
    requestId: string,
    dto: AnswerInfoRequestDto,
    user: AuthenticatedUser,
  ) {
    const infoReq = await this.prisma.projectInfoRequest.findUnique({
      where: { id: requestId },
      include: { project: { select: { companyId: true } } },
    });
    if (!infoReq || infoReq.projectId !== projectId) {
      throw new NotFoundException(
        this.i18n.t('project.info_request_not_found'),
      );
    }
    if (infoReq.status !== 'PENDING') {
      throw new BadRequestException(
        this.i18n.t('project.info_request_already_answered'),
      );
    }

    await this.resourceAccess.assertCanRead(user, {
      companyId: infoReq.project.companyId,
      projectId,
    });

    const encryptedValue = this.crypto.encryptString(dto.value);

    const updated = await this.prisma.projectInfoRequest.update({
      where: { id: requestId },
      data: {
        status: 'ANSWERED',
        encryptedValue,
        answeredById: user.id,
        answeredAt: new Date(),
      },
    });

    await this.notifications.notify({
      type: ProjectNotificationType.INFO_REQUEST_ANSWERED,
      recipients: { userIds: [infoReq.requestedById] },
      titleKey: 'project.info_request_answered_title',
      title: this.i18n.t('project.info_request_answered_title'),
      messageKey: 'project.info_request_answered_message',
      message: this.i18n.t('project.info_request_answered_message', {
        args: { label: infoReq.label },
      }),
      payload: { projectId, infoRequestId: requestId, label: infoReq.label },
      actionUrl: `/project/${projectId}`,
      channels: { email: true },
    });

    return updated;
  }
}
