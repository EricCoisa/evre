import { Injectable } from '@nestjs/common';
import { SystemConfiguration } from 'src/domain/system-configuration/system-configuration.entity';
import { SystemConfigurationService } from '../system-configuration.service';
import { CapabilityRegistry } from '../../capability/capability.registry';
import {
  resolveRequirements,
  type RequirementsResult,
} from '../../capability/resolve-requirements.util';

@Injectable()
export class FindSystemConfigByLabelKeyUseCase {
  // Delega: 404, descriptografia e cache num só lugar.
  constructor(
    private readonly service: SystemConfigurationService,
    private readonly capabilities: CapabilityRegistry,
  ) {}

  /** `viewer` ausente (visitante sem sessão) ⇒ nem resolve capability: `requirements` some do JSON. */
  async execute(
    labelKey: string,
    viewer?: { roleName: string },
  ): Promise<SystemConfiguration & { requirements?: RequirementsResult }> {
    const config = await this.service.findByLabelKey(labelKey);
    if (!viewer) return config;

    const capabilityMap = await this.capabilities.resolveAll(viewer.roleName);
    const requirements = resolveRequirements(
      labelKey,
      this.capabilities,
      capabilityMap,
      viewer.roleName,
    );
    return requirements ? { ...config, requirements } : config;
  }
}
