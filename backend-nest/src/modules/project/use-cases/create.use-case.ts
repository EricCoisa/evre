import { Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { LogActions } from 'src/domain/logging/log-actions';
import type { CreateProjectDto } from '../dto/create-project.dto';

@Injectable()
export class CreateProjectUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loggingService: LoggingService,
    private readonly i18n: I18nService,
  ) {}

  async execute(dto: CreateProjectDto, performedById: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: dto.companyId },
      select: { id: true, archivedAt: true },
    });
    if (!company || company.archivedAt) {
      throw new NotFoundException(this.i18n.t('company.not_found'));
    }

    const created = await this.prisma.project.create({
      data: { ...dto },
    });

    await this.loggingService.create(
      {
        module: 'PROJECT',
        action: LogActions.CREATE,
        message: `Project criado: ${created.name}`,
        metadata: { projectId: created.id, companyId: created.companyId },
      },
      performedById,
    );

    return created;
  }
}
