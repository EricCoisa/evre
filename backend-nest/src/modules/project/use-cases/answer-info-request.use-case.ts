import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import { CryptoService } from 'src/common/infrastructure/crypto/crypto.service';
import { ResourceAccessService } from 'src/common/infrastructure/resource-access/resource-access.service';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import type { AnswerInfoRequestDto } from '../dto/answer-info-request.dto';

@Injectable()
export class AnswerInfoRequestUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly crypto: CryptoService,
    private readonly resourceAccess: ResourceAccessService,
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

    return this.prisma.projectInfoRequest.update({
      where: { id: requestId },
      data: {
        status: 'ANSWERED',
        encryptedValue,
        answeredById: user.id,
        answeredAt: new Date(),
      },
    });
  }
}
