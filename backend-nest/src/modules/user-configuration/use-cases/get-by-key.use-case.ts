import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { convertValueByType } from 'src/common/utils/conversor.util';
import { UserConfigurationDto } from '../dto/user-configuration.dto';
import { CapabilityRegistry } from '../../capability/capability.registry';
import { resolveRequirements } from '../../capability/resolve-requirements.util';

@Injectable()
export class GetUserConfigurationByKeyUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly capabilities: CapabilityRegistry,
  ) {}

  // Rota sempre autenticada (nunca anônima): usuário comum recebe `requirements` sem `reason`,
  // com `capability` — é o que faz a dica aparecer em notification-preferences-tab (7.6)
  // sem vazar erro de provider (ver 5.1).
  async execute(
    userId: string,
    labelKey: string,
    viewer: { roleName: string },
  ): Promise<UserConfigurationDto | null> {
    const definition = await this.prisma.userConfigurationDefinition.findFirst({
      where: { labelKey },
    });
    if (!definition) return null;
    const userConfig = await this.prisma.userConfiguration.findFirst({
      where: { userId, definitionId: definition.id },
      include: { definition: true },
    });
    const rawValue = userConfig ? userConfig.value : definition.defaultValue;

    const capabilityMap = await this.capabilities.resolveAll(viewer.roleName);
    const requirements = resolveRequirements(
      labelKey,
      this.capabilities,
      capabilityMap,
      viewer.roleName,
    );

    return {
      id: definition.id,
      labelKey: definition.labelKey,
      valueType: definition.valueType,
      options: definition.options,
      value: definition.secret
        ? '***'
        : convertValueByType(rawValue, definition.valueType),
      isCustomized: !!userConfig,
      isRequired: definition.isRequired,
      isSecret: definition.secret,
      ...(requirements ? { requirements } : {}),
    };
  }
}
