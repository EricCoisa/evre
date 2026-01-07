import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { CreateUserConfigurationDefinitionDto } from './dto/create-user-configuration-definition.dto';
import { UpdateUserConfigurationDefinitionDto } from './dto/update-user-configuration-definition.dto';
import { SetUserConfigurationDto } from './dto/set-user-configuration.dto';
import { LoggingService } from '../logging/logging.service';
import type { PaginationQuery } from '../../common/schemas/pagination.schema';
import type { PaginatedResponse } from '../../common/types/pagination.types';
import { UserConfigurationDefinition } from '@prisma/client';
import { LogActions } from 'src/common/types/logging.types';
import {
  convertValueByType,
  validateValueType,
} from 'src/utils/conversor.util';
import { UserConfigurationDto } from './dto/user-configuration.dto';

@Injectable()
export class UserConfigurationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly loggingService: LoggingService,
  ) {}

  // ===== DEFINITIONS =====
  async createDefinition(
    dto: CreateUserConfigurationDefinitionDto,
    performedById: string,
  ) {
    const existing = await this.prisma.userConfigurationDefinition.findUnique({
      where: { labelKey: dto.labelKey },
    });

    if (existing) {
      throw new ConflictException(
        this.i18n.t('user_configuration.definition_already_exists'),
      );
    }

    const definition = await this.prisma.userConfigurationDefinition.create({
      data: dto,
    });

    await this.loggingService.create(
      {
        module: 'USER_CONFIGURATION',
        action: LogActions.CREATE_DEFINITION,
        message: `Definição de configuração criada: ${definition.labelKey}`,
        metadata: { definitionId: definition.id, ...dto },
      },
      performedById,
    );

    return definition;
  }

  async findAllDefinitions(
    query: PaginationQuery,
  ): Promise<
    | PaginatedResponse<UserConfigurationDefinition>
    | UserConfigurationDefinition[]
  > {
    const { page, limit, pagination, search } = query;

    const where = search
      ? {
          OR: [
            { labelKey: { contains: search } },
            { valueType: { contains: search } },
          ],
        }
      : {};

    if (!pagination) {
      return await this.prisma.userConfigurationDefinition.findMany({
        where,
        orderBy: { labelKey: 'asc' },
      });
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.userConfigurationDefinition.findMany({
        where,
        skip,
        take: limit,
        orderBy: { labelKey: 'asc' },
      }),
      this.prisma.userConfigurationDefinition.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  async findOneDefinition(id: string) {
    const definition = await this.prisma.userConfigurationDefinition.findUnique(
      {
        where: { id },
      },
    );

    if (!definition) {
      throw new NotFoundException(
        this.i18n.t('user_configuration.definition_not_found'),
      );
    }

    return definition;
  }

  async updateDefinition(
    id: string,
    dto: UpdateUserConfigurationDefinitionDto,
    performedById: string,
  ) {
    await this.findOneDefinition(id);

    if (dto.labelKey) {
      const existing = await this.prisma.userConfigurationDefinition.findUnique(
        {
          where: { labelKey: dto.labelKey },
        },
      );

      if (existing && existing.id !== id) {
        throw new ConflictException(
          this.i18n.t('user_configuration.definition_already_exists'),
        );
      }
    }

    const definition = await this.prisma.userConfigurationDefinition.update({
      where: { id },
      data: dto,
    });

    await this.loggingService.create(
      {
        module: 'USER_CONFIGURATION',
        action: LogActions.UPDATE_DEFINITION,
        message: `Definição de configuração atualizada: ${definition.labelKey}`,
        metadata: { definitionId: id, ...dto },
      },
      performedById,
    );

    return definition;
  }

  async removeDefinition(id: string, performedById: string) {
    const definition = await this.findOneDefinition(id);

    await this.prisma.userConfigurationDefinition.delete({
      where: { id },
    });

    await this.loggingService.create(
      {
        module: 'USER_CONFIGURATION',
        action: LogActions.DELETE_DEFINITION,
        message: `Definição de configuração removida: ${definition.labelKey}`,
        metadata: { definitionId: id },
      },
      performedById,
    );

    return { message: this.i18n.t('user_configuration.definition_deleted') };
  }

  // ===== USER CONFIGURATIONS =====
  async getUserConfigurations(userId: string): Promise<UserConfigurationDto[]> {
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
        value,
        isCustomized: !!userConfig,
        isRequired: def.isRequired,
      };
    });
  }

  async getUserConfigurationsKey(
    userId: string,
    labelKey: string,
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
    return {
      id: definition.id,
      labelKey: definition.labelKey,
      valueType: definition.valueType,
      value: convertValueByType(rawValue, definition.valueType),
      isCustomized: !!userConfig,
      isRequired: definition.isRequired,
    };
  }

  async setUserConfiguration(
    userId: string,
    dto: SetUserConfigurationDto,
    performedById?: string,
  ) {
    const definition = await this.prisma.userConfigurationDefinition.findUnique(
      {
        where: { id: dto.definitionId },
      },
    );

    if (!definition) {
      throw new NotFoundException(
        this.i18n.t('user_configuration.definition_not_found'),
      );
    }

    // Validação básica de tipo
    validateValueType(dto.value, definition.valueType, this.i18n);

    const config = await this.prisma.userConfiguration.upsert({
      where: {
        userId_definitionId: {
          userId,
          definitionId: dto.definitionId,
        },
      },
      create: {
        userId,
        definitionId: dto.definitionId,
        value: dto.value,
      },
      update: {
        value: dto.value,
      },
      include: { definition: true },
    });

    await this.loggingService.create(
      {
        module: 'USER_CONFIGURATION',
        action: LogActions.SET_CONFIGURATION,
        message: `Configuração definida: ${definition.labelKey}`,
        metadata: { userId, definitionId: dto.definitionId, value: dto.value },
      },
      performedById || userId,
    );

    return config;
  }

  async resetUserConfiguration(
    userId: string,
    definitionId: string,
    performedById?: string,
  ) {
    const definition = await this.findOneDefinition(definitionId);

    const existing = await this.prisma.userConfiguration.findUnique({
      where: {
        userId_definitionId: { userId, definitionId },
      },
    });

    if (existing) {
      await this.prisma.userConfiguration.delete({
        where: { id: existing.id },
      });

      await this.loggingService.create(
        {
          module: 'USER_CONFIGURATION',
          action: LogActions.RESET_CONFIGURATION,
          message: `Configuração resetada: ${definition.labelKey}`,
          metadata: { userId, definitionId },
        },
        performedById || userId,
      );
    }

    return {
      message: this.i18n.t('user_configuration.configuration_reset'),
    };
  }

  async resetAllUserConfigurations(userId: string, performedById?: string) {
    await this.prisma.userConfiguration.deleteMany({
      where: { userId },
    });

    await this.loggingService.create(
      {
        module: 'USER_CONFIGURATION',
        action: LogActions.RESET_ALL_CONFIGURATIONS,
        message: 'Todas as configurações foram resetadas',
        metadata: { userId },
      },
      performedById || userId,
    );

    return {
      message: this.i18n.t('user_configuration.all_configurations_reset'),
    };
  }
}
