import { Injectable } from '@nestjs/common';
import { assertProviderOk } from 'src/common/utils/provider-result.util';
import { SystemConfigurationService } from '../../system-configuration/system-configuration.service';
import { SentryConfigService } from '../sentry-config.service';
import { sentryConfigKeys } from '../../../domain/observability/sentry.const';
import type { SaveSentryConfigDto } from '../dto/sentry-config.dto';

/** Valida o DSN do Sentry e só então grava; DSN em branco desliga sem validação. */
@Injectable()
export class SaveSentryConfigUseCase {
  constructor(
    private readonly sysConfig: SystemConfigurationService,
    private readonly sentry: SentryConfigService,
  ) {}

  async execute(dto: SaveSentryConfigDto, performedById: string) {
    const dsn = dto.dsn?.trim() ?? '';

    if (dsn) {
      assertProviderOk(await this.sentry.validateDsn(dsn));
    }

    await this.sysConfig.setManyByLabelKey(
      [{ labelKey: sentryConfigKeys.dsn, value: dsn }],
      performedById,
    );

    // O SDK só lê o DSN no boot (ver `src/instrument.ts`), então avisar aqui é o
    // que evita o admin achar que ligou o Sentry e ficar esperando evento.
    return {
      status: true,
      data: dsn
        ? 'DSN validado e salvo — reinicie o backend para o Sentry passar a enviar'
        : 'Sentry desligado — reinicie o backend para parar de enviar',
    };
  }
}
