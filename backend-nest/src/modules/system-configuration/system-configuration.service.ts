import {
  Injectable,
  NotFoundException,
  ConflictException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import type { PaginationQuery } from '../../common/schemas/pagination.schema';
import type { PaginatedResponse } from '../../common/types/pagination.types';
import { CreateSystemConfigurationDto } from './dto/create-system-configuration.dto';
import { UpdateSystemConfigurationDto } from './dto/update-system-configuration.dto';
import { LoggingService } from '../logging/logging.service';
import { LogClearTask } from '../tasks/logClear.task';
import { LogActions } from 'src/common/types/logging.types';
import { convertValueByType } from 'src/utils/conversor.util';
import { IBaseService } from 'src/domain/interface/base-service.interface';
import { SystemConfiguration } from 'src/domain/system-configuration/system-configuration.entity';

@Injectable()
export class SystemConfigurationService implements IBaseService<SystemConfiguration> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly loggingService: LoggingService,
    @Inject(forwardRef(() => LogClearTask))
    private readonly LogClearTask: LogClearTask,
  ) {}

  //TODO: OK
  async findAll(
    query: PaginationQuery,
  ): Promise<PaginatedResponse<SystemConfiguration> | SystemConfiguration[]> {
    const { page, limit, pagination, search } = query;

    const where = search
      ? {
          OR: [
            { labelKey: { contains: search } },
            { valueType: { contains: search } },
            { value: { contains: search } },
          ],
        }
      : {};

    if (!pagination) {
      return await this.prisma.systemConfiguration.findMany({
        where,
        orderBy: { labelKey: 'asc' },
      });
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.systemConfiguration.findMany({
        where,
        skip,
        take: limit,
        orderBy: { labelKey: 'asc' },
      }),
      this.prisma.systemConfiguration.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: data.map((config) => ({
        ...config,
        value:
          convertValueByType(config.value, config.valueType) ?? config.value,
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
  async findOne(id: string): Promise<SystemConfiguration> {
    const config = await this.prisma.systemConfiguration.findUnique({
      where: { id },
    });

    if (!config) {
      throw new NotFoundException(
        this.i18n.t('system_configuration.not_found'),
      );
    }

    return {
      ...config,
      value: convertValueByType(config.value, config.valueType) ?? config.value,
    };
  }

  //TODO: OK
  async create(
    data: CreateSystemConfigurationDto,
    performedById: string,
  ): Promise<SystemConfiguration> {
    const existing = await this.prisma.systemConfiguration.findUnique({
      where: { labelKey: data.labelKey },
    });

    if (existing) {
      throw new ConflictException(
        this.i18n.t('system_configuration.labelkey_already_exists'),
      );
    }

    const config = await this.prisma.systemConfiguration.create({
      data,
    });

    // Log da ação
    await this.loggingService.create(
      {
        module: 'SYSTEM_CONFIGURATION',
        action: LogActions.CREATE,
        message: `Configuração ${config.labelKey} criada`,
        metadata: {
          configId: config.id,
          labelKey: config.labelKey,
          valueType: config.valueType,
          value: config.value,
        },
      },
      performedById,
    );

    return {
      ...config,
      value: convertValueByType(config.value, config.valueType) ?? config.value,
    };
  }

  //TODO: OK
  async findByLabelKey(labelKey: string): Promise<SystemConfiguration> {
    const config = await this.prisma.systemConfiguration.findUnique({
      where: { labelKey },
    });

    if (!config) {
      throw new NotFoundException(
        this.i18n.t('system_configuration.not_found'),
      );
    }

    return {
      ...config,
      value: convertValueByType(config.value, config.valueType) ?? config.value,
    };
  }

  //TODO: OK
  async update(
    id: string,
    updateDto: UpdateSystemConfigurationDto,
    performedById: string,
  ): Promise<SystemConfiguration> {
    const config = await this.prisma.systemConfiguration.findUnique({
      where: { id },
    });

    if (!config) {
      throw new NotFoundException(
        this.i18n.t('system_configuration.not_found'),
      );
    }

    if (updateDto.labelKey && updateDto.labelKey !== config.labelKey) {
      const existing = await this.prisma.systemConfiguration.findUnique({
        where: { labelKey: updateDto.labelKey },
      });

      if (existing) {
        throw new ConflictException(
          this.i18n.t('system_configuration.labelkey_already_exists'),
        );
      }
    }

    const updatedConfig = await this.prisma.systemConfiguration.update({
      where: { id },
      data: updateDto,
    });

    // Log da ação
    await this.loggingService.create(
      {
        module: 'SYSTEM_CONFIGURATION',
        action: LogActions.UPDATE,
        message: `Configuração ${updatedConfig.labelKey} atualizada para ${updatedConfig.value}`,
        metadata: {
          configId: updatedConfig.id,
          labelKey: updatedConfig.labelKey,
          oldValue: config.value,
          newValue: updatedConfig.value,
        },
      },
      performedById,
    );

    void this.actionFire(updatedConfig);

    return {
      ...updatedConfig,
      value:
        convertValueByType(updatedConfig.value, updatedConfig.valueType) ??
        updatedConfig.value,
    };
  }

  //TODO: OK
  async remove(performedById: string, id: string) {
    const config = await this.prisma.systemConfiguration.findUnique({
      where: { id },
    });

    if (!config) {
      throw new NotFoundException(
        this.i18n.t('system_configuration.not_found'),
      );
    }

    await this.prisma.systemConfiguration.delete({
      where: { id },
    });

    // Log da ação
    await this.loggingService.create(
      {
        module: 'SYSTEM_CONFIGURATION',
        action: LogActions.DELETE,
        message: `Configuração ${config.labelKey} removida`,
        metadata: {
          configId: config.id,
          labelKey: config.labelKey,
          valueType: config.valueType,
          value: config.value,
        },
      },
      performedById,
    );

    return {
      status: true,
      message: this.i18n.t('system_configuration.deleted_successfully'),
    };
  }

  private async actionFire(updatedConfig: SystemConfiguration) {
    if (updatedConfig.labelKey === 'SYSTEMCONFIG_LOG_DELETE_DAY') {
      await this.LogClearTask.updateCronSchedule();
    }
  }
}
