import { Module } from '@nestjs/common';
import { FeatureFlagService } from './feature-flag.service';
import { FeatureFlagController } from './feature-flag.controller';
import { FeatureFlagGuard } from './feature-flag.guard';
import { PrismaModule } from '../../prisma/prisma.module';
import { ListFeatureFlagsTool } from './ai-tools/list-feature-flags.tool';
import { ToggleFeatureFlagTool } from './ai-tools/toggle-feature-flag.tool';
import { GetFeatureFlagTool } from './ai-tools/get-feature-flag.tool';
import { CreateFeatureFlagTool } from './ai-tools/create-feature-flag.tool';
import { UpdateFeatureFlagTool } from './ai-tools/update-feature-flag.tool';
import { RemoveFeatureFlagTool } from './ai-tools/remove-feature-flag.tool';
import { SetFeatureFlagRolesTool } from './ai-tools/set-feature-flag-roles.tool';
import { FindOneFeatureFlagUseCase } from './use-cases/find-one.use-case';
import { CreateFeatureFlagUseCase } from './use-cases/create.use-case';
import { UpdateFeatureFlagUseCase } from './use-cases/update.use-case';
import { RemoveFeatureFlagUseCase } from './use-cases/remove.use-case';
import { SetFeatureFlagRolesUseCase } from './use-cases/set-roles.use-case';
import { FeatureFlagsPageRouteCeiling } from './feature-flags-page.route-ceiling';

const USE_CASES = [
  FindOneFeatureFlagUseCase,
  CreateFeatureFlagUseCase,
  UpdateFeatureFlagUseCase,
  RemoveFeatureFlagUseCase,
  SetFeatureFlagRolesUseCase,
];

@Module({
  imports: [PrismaModule],
  controllers: [FeatureFlagController],
  providers: [
    FeatureFlagService,
    FeatureFlagGuard,
    ...USE_CASES,
    ListFeatureFlagsTool,
    ToggleFeatureFlagTool,
    GetFeatureFlagTool,
    CreateFeatureFlagTool,
    UpdateFeatureFlagTool,
    RemoveFeatureFlagTool,
    SetFeatureFlagRolesTool,
    FeatureFlagsPageRouteCeiling,
  ],
  exports: [FeatureFlagService, FeatureFlagGuard],
})
export class FeatureFlagModule {}
