import { Injectable, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';

import { CreateLogParams } from './dto/create-logging-dto';
import { Logging } from 'src/domain/logging/logging.entity';
import { ClientLogService } from '../client-log/client-log.service';
import { SystemConfigurationService } from '../system-configuration/system-configuration.service';
import {
  LOG_MIN_LEVEL_CONFIG_KEY,
  LogLevel,
  passesLevel,
} from 'src/domain/logging/log-level.const';

@Injectable()
export class LoggingService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() @InjectQueue('audit') private readonly auditQueue: Queue | null,
    @Optional() private readonly clientLog?: ClientLogService,
    @Optional() private readonly systemConfig?: SystemConfigurationService,
  ) {}

  /** Nível mínimo gravado em SystemConfiguration; valor ausente ou inválido cai em DEBUG. */
  private async minimumLevel(): Promise<LogLevel> {
    if (!this.systemConfig) return LogLevel.DEBUG;
    try {
      const raw = await this.systemConfig.getValueOrNull(
        LOG_MIN_LEVEL_CONFIG_KEY,
      );
      const value = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
      return value in LogLevel ? (value as LogLevel) : LogLevel.DEBUG;
    } catch {
      return LogLevel.DEBUG;
    }
  }

  /** Direct DB write — used by AuditProcessor and sync fallback. */
  async writeNow(
    data: CreateLogParams,
    performedById: null | string,
  ): Promise<Logging> {
    const logData = {
      module: data.module,
      action: data.action,
      message: data.message,
      metadata: data.metadata != null ? data.metadata : Prisma.DbNull,
      performedById: performedById,
    };
    const log = await this.prisma.systemLog.create({
      data: logData,
    });

    // Envia log para o suporte de forma assíncrona (fire and forget)
    if (this.clientLog) {
      this.clientLog
        .create({
          metadata: logData,
        })
        .catch(() => {
          // Ignora erros silenciosamente
        });
    }

    return log;
  }

  async create(
    data: CreateLogParams,
    performedById: null | string,
  ): Promise<void> {
    if (!passesLevel(data.action, await this.minimumLevel())) return;

    // Try queue, fall through to sync write if unavailable
    if (this.auditQueue) {
      try {
        await this.auditQueue.add('write', { data, performedById });
        return;
      } catch {
        await this.writeNow(data, performedById);
        return;
      }
    }
    await this.writeNow(data, performedById);
  }
}
