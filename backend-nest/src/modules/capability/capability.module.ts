import { Global, Module } from '@nestjs/common';
import { FeatureFlagModule } from '../feature-flag/feature-flag.module';
import { CapabilityRegistry } from './capability.registry';
import { CapabilityController } from './capability.controller';
import { ListCapabilitiesTool } from './ai-tools/list-capabilities.tool';

@Global()
@Module({
  imports: [FeatureFlagModule],
  controllers: [CapabilityController],
  providers: [CapabilityRegistry, ListCapabilitiesTool],
  exports: [CapabilityRegistry],
})
export class CapabilityModule {}
