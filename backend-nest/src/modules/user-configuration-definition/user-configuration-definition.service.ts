import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import type { PaginationQuery } from '../../common/schemas/pagination.schema';
import type { PaginatedResponse } from '../../common/types/pagination.types';
import { CreateSystemConfigurationDto } from './dto/create-system-configuration.dto';

import { LoggingService } from '../logging/logging.service';
import { LogActions } from 'src/common/types/logging.types';

import { SetSystemConfigurationDto } from './dto/set-user-configuration-definition.dto';
import { UpdateUserConfigurationDefinitionsDto } from './dto/update-user-configuration-definition.dto';
import {
  convertValueByType,
  validateValueType,
} from 'src/utils/conversor.util';
import { IBaseService } from 'src/domain/interface/base-service.interface';
import { UserConfigurationDefinition } from 'src/domain/user-configuration-definition/user-configuration-definiton.entity';

@Injectable()
export class UserConfigurationDefinitionService implements IBaseService<UserConfigurationDefinition> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly loggingService: LoggingService,
  ) {}

  //TODO: OK
  async findAll(
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
            { defaultValue: { contains: search } },
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
      data: data.map((config) => ({
        ...config,
        defaultValue:
          convertValueByType(config.defaultValue, config.valueType) ??
          config.defaultValue,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  //TODO: OK
  async findOne(id: string): Promise<UserConfigurationDefinition> {
    const config = await this.prisma.userConfigurationDefinition.findUnique({
      where: { id },
    });

    if (!config) {
      throw new NotFoundException(
        this.i18n.t('system_configuration.not_found'),
      );
    }

    return {
      ...config,
      defaultValue:
        convertValueByType(config.defaultValue, config.valueType) ??
        config.defaultValue,
    };
  }

  //TODO: OK
  async create(
    createDto: CreateSystemConfigurationDto,
    performedById: string,
  ): Promise<UserConfigurationDefinition> {
    const existing = await this.prisma.userConfigurationDefinition.findUnique({
      where: { labelKey: createDto.labelKey },
    });

    if (existing) {
      throw new ConflictException(
        this.i18n.t('system_configuration.labelkey_already_exists'),
      );
    }

    const config = await this.prisma.userConfigurationDefinition.create({
      data: createDto,
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
          defaultValue: config.defaultValue,
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

  async update(
    id: string,
    updateDto: UpdateUserConfigurationDefinitionsDto,
    performedById: string,
  ): Promise<UserConfigurationDefinition> {
    const config = await this.prisma.userConfigurationDefinition.findUnique({
      where: { id },
    });

    if (!config) {
      throw new NotFoundException(
        this.i18n.t('system_configuration.not_found'),
      );
    }

    if (updateDto.labelKey && updateDto.labelKey !== config.labelKey) {
      const existing = await this.prisma.userConfigurationDefinition.findUnique(
        {
          where: { labelKey: updateDto.labelKey },
        },
      );

      if (existing) {
        throw new ConflictException(
          this.i18n.t('system_configuration.labelkey_already_exists'),
        );
      }
    }

    const updatedConfig = await this.prisma.userConfigurationDefinition.update({
      where: { id },
      data: updateDto,
    });

    // Log da ação
    await this.loggingService.create(
      {
        module: 'USER_CONFIGURATION_DEFINITION',
        action: LogActions.UPDATE,
        message: `Configuração de usuário ${updatedConfig.labelKey} atualizada para ${updatedConfig.defaultValue}`,
        metadata: {
          configId: updatedConfig.id,
          labelKey: updatedConfig.labelKey,
          oldValue: config.defaultValue,
          newValue: updatedConfig.defaultValue,
        },
      },
      performedById,
    );

    return {
      ...updatedConfig,
      defaultValue:
        convertValueByType(
          updatedConfig.defaultValue,
          updatedConfig.valueType,
        ) ?? updatedConfig.defaultValue,
    };
  }

  async remove(id: string, performedById: string) {
    const config = await this.prisma.userConfigurationDefinition.findUnique({
      where: { id },
    });

    if (!config) {
      throw new NotFoundException(
        this.i18n.t('system_configuration.not_found'),
      );
    }

    await this.prisma.userConfigurationDefinition.delete({
      where: { id },
    });

    // Log da ação
    await this.loggingService.create(
      {
        module: 'USER_CONFIGURATION_DEFINITION',
        action: LogActions.DELETE,
        message: `Configuração de usuário ${config.labelKey} removida`,
        metadata: {
          configId: config.id,
          labelKey: config.labelKey,
          valueType: config.valueType,
          value: config.defaultValue,
        },
      },
      performedById,
    );

    return {
      status: true,
      message: this.i18n.t('system_configuration.deleted_successfully'),
    };
  }

  //TODO: OK
  async findByLabelKey(labelKey: string): Promise<UserConfigurationDefinition> {
    const config = await this.prisma.userConfigurationDefinition.findUnique({
      where: { labelKey },
    });

    if (!config) {
      throw new NotFoundException(
        this.i18n.t('system_configuration.not_found'),
      );
    }

    return {
      ...config,
      defaultValue:
        convertValueByType(config.defaultValue, config.valueType) ??
        config.defaultValue,
    };
  }

  async setUserConfiguration(
    definitionId: string,
    dto: SetSystemConfigurationDto,
    performedById: string,
  ) {
    // Altera o defaultValue da definição global
    const definition = await this.prisma.userConfigurationDefinition.findUnique(
      {
        where: { id: definitionId },
      },
    );

    if (!definition) {
      throw new NotFoundException(
        this.i18n.t('user_configuration.definition_not_found'),
      );
    }

    // Validação básica de tipo
    validateValueType(dto.defaultValue, definition.valueType, this.i18n);

    const updated = await this.prisma.userConfigurationDefinition.update({
      where: { id: definitionId },
      data: { defaultValue: dto.defaultValue },
    });

    await this.loggingService.create(
      {
        module: 'USER_CONFIGURATION_DEFINITION',
        action: LogActions.SET_CONFIGURATION,
        message: `Default da definição alterado: ${definition.labelKey}`,
        metadata: {
          definitionId: definitionId,
          oldValue: definition.defaultValue,
          newValue: dto.defaultValue,
        },
      },
      performedById,
    );

    return updated;
  }
}
