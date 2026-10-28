import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { LoggingService } from '../../logging/logging.service';
import { LogActions } from 'src/domain/logging/log-actions';
import type { UpdateRouteDto } from '../dto/update-route.dto';
import { Route } from 'src/domain/route/route.entity';

@Injectable()
export class UpdateRouteUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly loggingService: LoggingService,
  ) {}

  async execute(
    id: string,
    dto: UpdateRouteDto,
    performedById: string,
  ): Promise<Route> {
    const existing = await this.prisma.route.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(this.i18n.t('route.not_found'));
    }

    if (dto.path && dto.path !== existing.path) {
      const pathConflict = await this.prisma.route.findUnique({
        where: { path: dto.path },
      });

      if (pathConflict) {
        throw new ConflictException(this.i18n.t('route.path_already_exists'));
      }
    }

    if (dto.parentId !== undefined) {
      if (dto.parentId && dto.parentId === id) {
        throw new ConflictException(
          this.i18n.t('route.cannot_be_parent_of_itself'),
        );
      }

      if (dto.parentId) {
        const parent = await this.prisma.route.findUnique({
          where: { id: dto.parentId },
        });

        if (!parent) {
          throw new NotFoundException(this.i18n.t('route.parent_not_found'));
        }
      }
    }

    const route = await this.prisma.route.update({
      where: { id },
      data: dto,
    });

    await this.loggingService.create(
      {
        module: 'ROUTE',
        action: LogActions.UPDATE,
        message: `Rota ${route.path} atualizada`,
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
