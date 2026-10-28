import { Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import { UserConfigurationDefinition } from 'src/domain/user-configuration-definition/user-configuration-definition.entity';
import { convertValueByType } from 'src/common/utils/conversor.util';

@Injectable()
export class FindOneUserConfigDefinitionUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  async execute(id: string): Promise<UserConfigurationDefinition> {
    const config = await this.prisma.userConfigurationDefinition.findUnique({
      where: { id },
    });

    if (!config) {
      throw new NotFoundException(
        this.i18n.t('user_configuration.definition_not_found'),
      );
    }

    return {
      ...config,
      defaultValue:
        convertValueByType(config.defaultValue, config.valueType) ??
        config.defaultValue,
    };
  }
}
