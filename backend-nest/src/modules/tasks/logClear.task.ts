import {
  Injectable,
  Logger,
  OnModuleInit,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { PrismaService } from '../../prisma/prisma.service';
import { SystemConfigurationService } from '../system-configuration/system-configuration.service';
import { LoggingService } from '../logging/logging.service';
import { LogActions } from 'src/common/types/logging.types';

@Injectable()
export class LogClearTask implements OnModuleInit {
  private readonly logger = new Logger(LogClearTask.name);
  private readonly jobName = 'cleanOldLogs';

  constructor(
    private readonly prisma: PrismaService,

    @Inject(forwardRef(() => SystemConfigurationService))
    private readonly systemConfigurationService: SystemConfigurationService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly loggingService: LoggingService,
  ) {}

  /**
   * Inicializa o cron job baseado nas configurações
   */
  async onModuleInit() {
    await this.updateCronSchedule();
  }

  /**
   * Lógica principal para limpeza dos logs
   */
  async handleLogCleanup() {
    try {
      // Intervalo de limpeza (dias)
      let deleteIntervalDays = 7;
      try {
        const cfg = await this.systemConfigurationService.findByLabelKey(
          'SYSTEMCONFIG_LOG_DELETE_DAY',
        );
        deleteIntervalDays = parseInt(cfg.value as string, 10) || 7;
      } catch {
        this.logger.warn(
          `Configuração SYSTEMCONFIG_LOG_DELETE_DAY não encontrada. Usando padrão (${deleteIntervalDays})`,
        );
      }

      // Última execução registrada
      const lastCleanupLog = await this.prisma.systemLog.findFirst({
        where: { module: 'SYSTEM', action: LogActions.LOG_CLEANUP },
        orderBy: { createdAt: 'desc' },
      });

      if (lastCleanupLog) {
        const daysSinceLastCleanup = Math.floor(
          (Date.now() - lastCleanupLog.createdAt.getTime()) /
            (1000 * 60 * 60 * 24),
        );

        if (daysSinceLastCleanup < deleteIntervalDays) {
          this.logger.log(
            `Última limpeza há ${daysSinceLastCleanup} dia(s). Aguardando ${
              deleteIntervalDays - daysSinceLastCleanup
            } dia(s).`,
          );
          return;
        }
      }

      // Limite máximo de logs
      let logLimit = 1000;
      try {
        const cfg = await this.systemConfigurationService.findByLabelKey(
          'SYSTEMCONFIG_LOG_LIMITE',
        );
        logLimit = parseInt(cfg.value as string, 10) || 1000;
      } catch {
        this.logger.warn(
          `Configuração SYSTEMCONFIG_LOG_LIMITE não encontrada. Usando padrão (${logLimit}).`,
        );
      }

      this.logger.log(`Iniciando limpeza. Mantendo apenas ${logLimit} logs.`);

      const totalLogs = await this.prisma.systemLog.count();

      if (totalLogs <= logLimit) {
        this.logger.log(
          `Total (${totalLogs}) dentro do limite (${logLimit}). Nada a limpar.`,
        );
        return;
      }

      const logsToDelete = totalLogs - logLimit;

      const oldestLogs = await this.prisma.systemLog.findMany({
        select: { id: true },
        orderBy: { createdAt: 'asc' },
        take: logsToDelete,
      });

      const idsToDelete = oldestLogs.map((l) => l.id);

      const deleteResult = await this.prisma.systemLog.deleteMany({
        where: { id: { in: idsToDelete } },
      });

      this.logger.log(
        `Limpeza concluída. ${deleteResult.count} logs removidos.`,
      );

      await this.loggingService.create(
        {
          module: 'SYSTEM',
          action: LogActions.LOG_CLEANUP,
          message: `Limpeza automática executada. ${deleteResult.count} removidos.`,
          metadata: {
            totalLogsBefore: totalLogs,
            logsDeleted: deleteResult.count,
            logsRemaining: totalLogs - deleteResult.count,
            logLimit,
          },
        },
        null,
      );
    } catch (err) {
      this.logger.error('Erro ao executar limpeza de logs:', err);
    }
  }

  /**
   * Cria ou recria o cron job diariamente às 00:00,
   * e a lógica interna decide se deve ou não limpar.
   */
  async updateCronSchedule() {
    try {
      let deleteIntervalDays = 7;
      try {
        const cfg = await this.systemConfigurationService.findByLabelKey(
          'SYSTEMCONFIG_LOG_DELETE_DAY',
        );
        deleteIntervalDays = parseInt(cfg.value as string, 10) || 7;
      } catch {
        this.logger.warn(
          `SYSTEMCONFIG_LOG_DELETE_DAY não encontrada. Usando padrão (${deleteIntervalDays}).`,
        );
      }

      // Remove cron antigo se existir
      try {
        const existingJob = this.schedulerRegistry.getCronJob(this.jobName);
        if (existingJob) {
          void existingJob.stop();
          this.schedulerRegistry.deleteCronJob(this.jobName);
          this.logger.log(`Job '${this.jobName}' removido.`);
        }
      } catch {
        // ignorar se não existir
      }

      // Cria novo cron (diário, 00:00)
      const job = new CronJob('0 0 * * *', async () => {
        await this.handleLogCleanup();
      });

      this.schedulerRegistry.addCronJob(this.jobName, job);
      job.start();

      this.logger.log(
        `Cron configurado (execução diária). Intervalo interno: ${deleteIntervalDays} dia(s).`,
      );
    } catch (err) {
      this.logger.error('Erro ao atualizar cron:', err);

      // fallback
      const job = new CronJob('0 0 * * *', async () => this.handleLogCleanup());
      this.schedulerRegistry.addCronJob(this.jobName, job);
      job.start();

      this.logger.warn('Fallback ativado: cron diário padrão.');
    }
  }

  /**
   * Execução manual (para testes ou painel admin)
   */
  async executeLogCleanupManually() {
    this.logger.log('Execução manual solicitada...');
    await this.handleLogCleanup();
  }
}
