import { Injectable, ConflictException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoggingService } from '../../logging/logging.service';
import { CryptoService } from 'src/common/infrastructure/crypto/crypto.service';
import { CreateUserConfigurationDefinitionCreateDto } from '../dto/create-system-configuration.dto';
import { UserConfigurationDefinition } from 'src/domain/user-configuration-definition/user-configuration-definition.entity';
import { LogActions } from 'src/domain/logging/log-actions';
import { convertValueByType } from 'src/common/utils/conversor.util';
import { maskIfSecret } from 'src/common/utils/mask-secret-for-log.util';

@Injectable()
export class CreateUserConfigDefinitionUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly loggingService: LoggingService,
    private readonly cryptoService: CryptoService,
  ) {}

  async execute(
    createDto: CreateUserConfigurationDefinitionCreateDto,
    performedById: string,
  ): Promise<UserConfigurationDefinition> {
    const existing = await this.prisma.userConfigurationDefinition.findUnique({
      where: { labelKey: createDto.labelKey },
    });

    if (existing) {
      throw new ConflictException(
        this.i18n.t('user_configuration.definition_already_exists'),
      );
    }

    // Default de uma definição `secret` vai criptografado, igual ao valor por
    // usuário — ninguém lê em claro: as leituras devolvem `****` (mask util).
    const config = await this.prisma.userConfigurationDefinition.create({
      data: {
        ...createDto,
        defaultValue:
          createDto.secret && createDto.defaultValue
            ? this.cryptoService.encryptString(createDto.defaultValue)
            : createDto.defaultValue,
      },
    });

    // Log da ação
    await this.loggingService.create(
      {
        module: 'USER_CONFIGURATION_DEFINITION',
        action: LogActions.CREATE,
        message: `Configuração de usuário ${config.labelKey} criada`,
        metadata: {
          configId: config.id,
          labelKey: config.labelKey,
          valueType: config.valueType,
          defaultValue: maskIfSecret(config.secret, config.defaultValue),
        },
      },
      performedById,
    );

    return {
      ...config,
      defaultValue:
        convertValueByType(config.defaultValue, config.valueType) ??
        config.defaultValue,
    };
  }
}
