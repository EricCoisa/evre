import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { Route } from 'src/domain/route/route.entity';

@Injectable()
export class FindOneRouteUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  async execute(id: string): Promise<Route> {
    const route = await this.prisma.route.findUnique({
      where: { id },
    });

    if (!route) {
      throw new NotFoundException(this.i18n.t('route.not_found'));
    }

    return route;
  }
}
