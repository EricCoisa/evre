import { Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AuthenticatedUser } from 'src/common/types/auth.types';
import type { CreateInfoRequestDto } from '../dto/create-info-request.dto';

@Injectable()
export class CreateInfoRequestUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  async execute(
    projectId: string,
    dto: CreateInfoRequestDto,
    user: AuthenticatedUser,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException(this.i18n.t('project.not_found'));
    }

    return this.prisma.projectInfoRequest.create({
      data: {
        projectId,
        label: dto.label,
        description: dto.description,
        requestedById: user.id,
      },
    });
  }
}
