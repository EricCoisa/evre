import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { FeatureFlagService } from '../feature-flag.service';
import { FindOneFeatureFlagUseCase } from './find-one.use-case';

@Injectable()
export class RemoveFeatureFlagUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly flags: FeatureFlagService,
    private readonly findOne: FindOneFeatureFlagUseCase,
  ) {}

  async execute(id: string): Promise<{ status: true }> {
    await this.findOne.execute(id);
    await this.prisma.featureFlag.delete({ where: { id } });
    await this.flags.invalidate();
    return { status: true };
  }
}
