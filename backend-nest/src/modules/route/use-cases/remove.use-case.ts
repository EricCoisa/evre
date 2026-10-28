import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { LoggingService } from '../../logging/logging.service';
import { LogActions } from 'src/domain/logging/log-actions';

@Injectable()
export class RemoveRouteUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly loggingService: LoggingService,
  ) {}

  // (id, performedById) como os outros use-cases de rota. A ordem era invertida
  // aqui e o RouteService, que só repassava, trocava os argumentos para compensar.
  async execute(id: string, performedById: string) {
    const existing = await this.prisma.route.findUnique({
      where: { id },
      include: { children: true },
    });

    if (!existing) {
      throw new NotFoundException(this.i18n.t('route.not_found'));
    }

    if (existing.children.length > 0) {
      throw new ConflictException(this.i18n.t('route.has_children'));
    }

    await this.prisma.route.delete({ where: { id } });

    await this.loggingService.create(
      {
        module: 'ROUTE',
        action: LogActions.DELETE,
        message: `Rota ${existing.path} removida`,
        metadata: {
          routeId: existing.id,
          path: existing.path,
          labelKey: existing.labelKey,
        },
      },
      performedById,
    );

    return { status: true, message: this.i18n.t('route.deleted_successfully') };
  }
}
