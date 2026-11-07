import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AuthenticatedUser } from 'src/common/types/auth.types';

@Injectable()
export class CancelInfoRequestUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  async execute(
    projectId: string,
    requestId: string,
    _user: AuthenticatedUser,
  ) {
    const infoRequest = await this.prisma.projectInfoRequest.findFirst({
      where: { id: requestId, projectId },
    });
    if (!infoRequest) {
      throw new NotFoundException(
        this.i18n.t('project.info_request_not_found'),
      );
    }
    if (infoRequest.status !== 'PENDING') {
      throw new BadRequestException(
        this.i18n.t('project.info_request_cannot_cancel'),
      );
    }

    return this.prisma.projectInfoRequest.update({
      where: { id: requestId },
      data: {
        status: 'CANCELLED',
      },
    });
  }
}
