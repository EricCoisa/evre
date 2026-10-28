import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { FeatureFlagWithRoles } from 'src/domain/feature-flag/feature-flag.entity';
import { FeatureFlagService } from '../feature-flag.service';
import { FindOneFeatureFlagUseCase } from './find-one.use-case';

@Injectable()
export class SetFeatureFlagRolesUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly flags: FeatureFlagService,
    private readonly findOne: FindOneFeatureFlagUseCase,
  ) {}

  async execute(id: string, roleIds: string[]): Promise<FeatureFlagWithRoles> {
    await this.findOne.execute(id);

    // Troca a allowlist inteira de uma vez.
    await this.prisma.$transaction([
      this.prisma.featureFlagRole.deleteMany({ where: { featureFlagId: id } }),
      ...(roleIds.length > 0
        ? [
            this.prisma.featureFlagRole.createMany({
              data: roleIds.map((roleId) => ({ featureFlagId: id, roleId })),
            }),
          ]
        : []),
    ]);

    await this.flags.invalidate();
    return this.findOne.execute(id);
  }
}
