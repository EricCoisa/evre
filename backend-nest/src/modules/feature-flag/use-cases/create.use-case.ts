import { Injectable, ConflictException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  FeatureFlagInclude,
  type FeatureFlagWithRoles,
} from 'src/domain/feature-flag/feature-flag.entity';
import { FeatureFlagService } from '../feature-flag.service';
import type { CreateFeatureFlagDto } from '../dto/create-feature-flag.dto';

@Injectable()
export class CreateFeatureFlagUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly flags: FeatureFlagService,
  ) {}

  async execute(dto: CreateFeatureFlagDto): Promise<FeatureFlagWithRoles> {
    const existing = await this.prisma.featureFlag.findUnique({
      where: { key: dto.key },
    });

    if (existing) {
      throw new ConflictException(
        this.i18n.t('feature_flag.key_already_exists'),
      );
    }

    if (dto.parentId) {
      await this.flags.assertValidParent(null, dto.parentId);
    }

    const flag = await this.prisma.featureFlag.create({
      data: {
        key: dto.key,
        description: dto.description,
        category: dto.category ?? 'GENERAL',
        isSystem: dto.isSystem ?? false,
        enabled: dto.enabled ?? false,
        parentId: dto.parentId,
      },
      include: FeatureFlagInclude,
    });

    await this.flags.invalidate();
    return flag;
  }
}
