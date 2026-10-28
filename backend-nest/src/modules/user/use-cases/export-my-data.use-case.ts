import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';

@Injectable()
export class ExportMyDataUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  async execute(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userConfigurations: { include: { definition: true } },
        userRouteAccesses: { include: { route: true } },
        systemLogs: {
          where: { performedById: userId },
          orderBy: { createdAt: 'desc' },
          take: 1000,
        },
      },
    });

    if (!user) throw new NotFoundException(this.i18n.t('user.not_found'));

    const { image, hash: _hash, salt: _salt, ...userData } = user;
    return {
      ...userData,
      hasImage: image !== null,
      userConfigurations: user.userConfigurations.map((uc) => ({
        labelKey: uc.definition.labelKey,
        value: uc.value,
      })),
      userRouteAccesses: user.userRouteAccesses.map((ura) => ura.route.path),
      systemLogs: user.systemLogs,
    };
  }
}
