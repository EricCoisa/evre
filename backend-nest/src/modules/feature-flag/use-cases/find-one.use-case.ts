import { Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  FeatureFlagInclude,
  type FeatureFlagWithRoles,
} from 'src/domain/feature-flag/feature-flag.entity';

@Injectable()
export class FindOneFeatureFlagUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  async execute(id: string): Promise<FeatureFlagWithRoles> {
    const flag = await this.prisma.featureFlag.findUnique({
      where: { id },
      include: FeatureFlagInclude,
    });

    if (!flag) {
      throw new NotFoundException(this.i18n.t('feature_flag.not_found'));
    }

    return flag;
  }
}
