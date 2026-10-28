import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  FeatureFlagInclude,
  type FeatureFlagWithRoles,
} from 'src/domain/feature-flag/feature-flag.entity';
import { FeatureFlagService } from '../feature-flag.service';
import { FindOneFeatureFlagUseCase } from './find-one.use-case';
import type { UpdateFeatureFlagDto } from '../dto/update-feature-flag.dto';

@Injectable()
export class UpdateFeatureFlagUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly flags: FeatureFlagService,
    private readonly findOne: FindOneFeatureFlagUseCase,
  ) {}

  async execute(
    id: string,
    dto: UpdateFeatureFlagDto,
  ): Promise<FeatureFlagWithRoles> {
    await this.findOne.execute(id);

    if (dto.parentId !== undefined) {
      await this.flags.assertValidParent(id, dto.parentId);
    }

    const flag = await this.prisma.featureFlag.update({
      where: { id },
      data: dto,
      include: FeatureFlagInclude,
    });

    await this.flags.invalidate();
    return flag;
  }
}
