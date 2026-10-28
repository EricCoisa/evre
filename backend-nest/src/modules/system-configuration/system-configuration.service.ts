import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { CreateSystemConfigurationDto } from './dto/create-system-configuration.dto';
import { UpdateSystemConfigurationDto } from './dto/update-system-configuration.dto';
import { convertValueByType } from 'src/common/utils/conversor.util';
import { CryptoService } from '../../common/infrastructure/crypto/crypto.service';
import { RedisService } from '../../common/infrastructure/redis/redis.service';
import { SystemConfiguration } from 'src/domain/system-configuration/system-configuration.entity';
import type { SystemConfiguration as StoredConfig } from '@prisma/client';
import {
  CONFIG_CACHE_MISS,
  CONFIG_CACHE_TTL,
  configCacheKey,
} from 'src/domain/system-configuration/system-configuration.const';
import { FindOneSystemConfigurationUseCase } from './use-cases/find-one.use-case';
import { CreateSystemConfigurationUseCase } from './use-cases/create.use-case';
import { UpdateSystemConfigurationUseCase } from './use-cases/update.use-case';
import type { CapabilityCheckResult } from 'src/domain/capability/capability.types';

/** Só o que tem chamador interno; o resto delega ao use-case. */
@Injectable()
export class SystemConfigurationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly cryptoService: CryptoService,
    private readonly redis: RedisService,
    private readonly findOne$: FindOneSystemConfigurationUseCase,
    private readonly create$: CreateSystemConfigurationUseCase,
    private readonly update$: UpdateSystemConfigurationUseCase,
  ) {}

  /** Retorna a linha crua da chave, com cache Redis; null se a chave não existe. */
  private async findRaw(labelKey: string): Promise<StoredConfig | null> {
    const key = configCacheKey(labelKey);
    const cached = await this.redis.get(key);
    if (cached === CONFIG_CACHE_MISS) return null;
    if (cached) {
      try {
        const row = JSON.parse(cached) as StoredConfig;
        return { ...row, updatedAt: new Date(row.updatedAt) };
      } catch {
        // entrada corrompida — cai no banco
      }
    }

    const config = await this.prisma.systemConfiguration.findUnique({
      where: { labelKey },
    });
    await this.redis.set(
      key,
      config ? JSON.stringify(config) : CONFIG_CACHE_MISS,
      CONFIG_CACHE_TTL,
    );
    return config;
  }

  /** Delega ao use-case. */
  findOne(id: string): Promise<SystemConfiguration> {
    return this.findOne$.execute(id);
  }

  /** Delega ao use-case. */
  create(
    data: CreateSystemConfigurationDto,
    performedById: string,
  ): Promise<SystemConfiguration> {
    return this.create$.execute(data, performedById);
  }

  /** Delega ao use-case, com o guard de `blocked`. */
  update(
    id: string,
    updateDto: UpdateSystemConfigurationDto,
    performedById: string,
  ): Promise<SystemConfiguration> {
    return this.update$.execute(id, updateDto, performedById);
  }

  async findByLabelKey(labelKey: string): Promise<SystemConfiguration> {
    const config = await this.findRaw(labelKey);

    if (!config) {
      throw new NotFoundException(
        this.i18n.t('system_configuration.not_found'),
      );
    }

    // Retorna valor descriptografado (valor real)
    const rawValue = config.secret
      ? this.cryptoService.tryDecrypt(config.value)
      : config.value;
    return {
      ...config,
      value: convertValueByType(rawValue, config.valueType) ?? rawValue,
    };
  }

  /** Retorna o valor descriptografado, ou null quando a chave não existe. */
  async getValueOrNull(labelKey: string): Promise<string | null> {
    const config = await this.findRaw(labelKey);
    if (!config) return null;
    return config.secret
      ? this.cryptoService.tryDecrypt(config.value)
      : config.value;
  }

  /** Mantém o valor já gravado quando o campo secreto vem vazio do formulário. */
  async keepStoredWhenBlank(
    value: string | undefined | null,
    labelKey: string,
  ): Promise<string> {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
    return (await this.getValueOrNull(labelKey)) ?? '';
  }

  /** "Configurado" para recurso sem o que pingar: todas as chaves não-vazias. */
  async allFilled(labelKeys: string[]): Promise<CapabilityCheckResult> {
    const values = await Promise.all(
      labelKeys.map((k) => this.getValueOrNull(k)),
    );
    const missing = labelKeys.filter((_, i) => !values[i]?.trim());
    if (missing.length === 0) return { operational: true };
    return {
      operational: false,
      reason: this.i18n.t('capability.missing_keys', {
        args: { keys: missing.join(', ') },
      }),
    };
  }

  /** Grava várias chaves de configuração de uma vez, sequencialmente. */
  async setManyByLabelKey(
    entries: Array<{
      labelKey: string;
      value: string;
      valueType?: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON' | 'DATE' | 'ENUM';
      options?: string[];
      secret?: boolean;
    }>,
    performedById: string,
  ): Promise<void> {
    for (const entry of entries) {
      const existing = await this.prisma.systemConfiguration.findUnique({
        where: { labelKey: entry.labelKey },
      });

      if (existing) {
        await this.update(existing.id, { value: entry.value }, performedById);
        continue;
      }

      // Chave ainda não semeada — acontece ao registrar um provider novo em
      // OAuthProviders sem rodar o seed. Criar aqui evita 404 no formulário.
      await this.create(
        {
          labelKey: entry.labelKey,
          value: entry.value,
          valueType: entry.valueType ?? 'STRING',
          options: entry.options ?? [],
          secret: entry.secret ?? false,
        },
        performedById,
      );
    }
  }
}
