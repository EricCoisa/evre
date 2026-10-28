import { Injectable, Logger } from '@nestjs/common';
import type { ProviderResult } from 'src/domain/interface/provider-result';
import { parseSentryDsn } from '../../domain/observability/sentry.const';

/** Sonda de DSN: Sentry fora do ar não pode pendurar a tela de configuração. */
const PROBE_TIMEOUT_MS = 5000;

@Injectable()
export class SentryConfigService {
  private readonly logger = new Logger(SentryConfigService.name);

  /** Sonda o DSN do Sentry antes de gravar, com um POST vazio no endpoint de ingestão. */
  async validateDsn(dsn: string): Promise<ProviderResult> {
    const parsed = parseSentryDsn(dsn);
    if (!parsed) {
      return {
        status: false,
        data: 'DSN fora do formato esperado (https://CHAVE@host/ID_DO_PROJETO)',
      };
    }

    let response: Response;
    try {
      response = await fetch(parsed.envelopeUrl, {
        method: 'POST',
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      });
    } catch (err) {
      // Igual ao captcha na hora de CONFIGURAR: não falha aberto. Gravar um DSN
      // que ninguém conseguiu conferir deixa o Sentry mudo sem ninguém saber.
      return {
        status: false,
        data: `Não foi possível falar com o Sentry: ${String(
          (err as Error)?.message ?? err,
        )}`,
      };
    }

    if (response.status === 401 || response.status === 403) {
      return {
        status: false,
        data: 'Chave pública do DSN recusada pelo Sentry',
      };
    }

    if (response.status === 404) {
      return {
        status: false,
        data: `Projeto ${parsed.projectId} não existe neste host do Sentry`,
      };
    }

    this.logger.log(
      `DSN do Sentry validado (projeto ${parsed.projectId}, HTTP ${response.status})`,
    );
    return { status: true, data: 'DSN válido' };
  }
}
