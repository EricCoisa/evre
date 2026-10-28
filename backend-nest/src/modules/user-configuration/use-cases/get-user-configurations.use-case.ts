import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { convertValueByType } from 'src/common/utils/conversor.util';
import { UserConfigurationDto } from '../dto/user-configuration.dto';

@Injectable()
export class GetUserConfigurationsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(userId: string): Promise<UserConfigurationDto[]> {
    const definitions =
      await this.prisma.userConfigurationDefinition.findMany();
    const userConfigs = await this.prisma.userConfiguration.findMany({
      where: { userId },
      include: { definition: true },
    });

    // Mescla definições com valores customizados do usuário
    return definitions.map((def) => {
      const userConfig = userConfigs.find((uc) => uc.definitionId === def.id);
      const rawValue = userConfig ? userConfig.value : def.defaultValue;
      const value: string | number | boolean | object | null =
        convertValueByType(rawValue, def.valueType);
      return {
        id: def.id,
        labelKey: def.labelKey,
        valueType: def.valueType,
        options: def.options,
        value: def.secret ? '***' : value,
        isCustomized: !!userConfig,
        isRequired: def.isRequired,
        isSecret: def.secret,
      };
    });
  }
}
