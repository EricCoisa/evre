import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { CreateClientLogParams } from './dto/create-client-log.dto';
import { SystemConfigurationService } from '../system-configuration/system-configuration.service';

@Injectable()
export class ClientLogService {
  private readonly logger = new Logger(ClientLogService.name);

  /** Injeta SystemConfigurationService via forwardRef para resolver a dependência circular entre os módulos. */
  constructor(
    @Inject(forwardRef(() => SystemConfigurationService))
    private systemConfigurationService: SystemConfigurationService,
  ) {}

  async create(data: CreateClientLogParams) {
    const sendLog = (
      await this.systemConfigurationService.findByLabelKey(
        'SYSTEMCONFIG_SENDLOG',
      )
    ).value as boolean;

    if (sendLog == false) {
      return null;
    }

    // Busca a URL de suporte
    const urlSupportConfig =
      await this.systemConfigurationService.findByLabelKey(
        'SYSTEMCONFIG_SUPORTURL',
      );
    const urlSupport = urlSupportConfig.value as string;

    const sistemIDConfig =
      await this.systemConfigurationService.findByLabelKey('SYSTEMID');
    const sistemId = sistemIDConfig.value as string;

    const tokenSystemConfig =
      await this.systemConfigurationService.findByLabelKey('SYSTEMTOKEN');
    const tokenSystem = tokenSystemConfig.value as string;

    const env = process.env.NEST_PUBLIC_ENV || 'development';

    // Monta a URL do webhook
    const webhookUrl = `${urlSupport.replace(/\/$/, '')}/api/clientLog/webhook`;

    if (!webhookUrl || !sistemId || !tokenSystem) {
      this.logger.warn(
        'Envio de log ao suporte desligado: falta SYSTEMCONFIG_SUPORTURL, SYSTEMID ou SYSTEMTOKEN.',
      );
      return null;
    }

    // Faz o POST usando axios, incluindo o sistemId como Authorization
    try {
      const axios = (await import('axios')).default;
      await axios.post(
        webhookUrl,
        {
          environment: env,
          metadata: JSON.stringify(data.metadata),
        },
        {
          headers: {
            'x-project-id': sistemId,
            authorization: tokenSystem,
          },
        },
      );
    } catch (e) {
      // Best-effort: o webhook de suporte nunca derruba o fluxo que gerou o log.
      this.logger.warn(`Webhook de suporte falhou: ${String(e)}`);
    }
    return null;
  }
}
