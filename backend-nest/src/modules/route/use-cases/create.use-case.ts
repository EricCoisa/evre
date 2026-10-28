import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { LoggingService } from '../../logging/logging.service';
import { LogActions } from 'src/domain/logging/log-actions';
import type { CreateRouteDto } from '../dto/create-route.dto';
import { Route } from 'src/domain/route/route.entity';

@Injectable()
export class CreateRouteUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly loggingService: LoggingService,
  ) {}

  async execute(dto: CreateRouteDto, performedById: string): Promise<Route> {
    const existing = await this.prisma.route.findUnique({
      where: { path: dto.path },
    });

    if (existing) {
      throw new ConflictException(this.i18n.t('route.path_already_exists'));
    }

    if (dto.parentId) {
      const parent = await this.prisma.route.findUnique({
        where: { id: dto.parentId },
      });

      if (!parent) {
        throw new NotFoundException(this.i18n.t('route.parent_not_found'));
      }
    }

    const route = await this.prisma.route.create({
      data: dto,
    });

    await this.loggingService.create(
      {
        module: 'ROUTE',
        action: LogActions.CREATE,
        message: `Rota ${route.path} criada`,
        metadata: {
          routeId: route.id,
          path: route.path,
          labelKey: route.labelKey,
          parentId: route.parentId,
        },
      },
      performedById,
    );

    return route;
  }
}
