import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { SystemConfigurationService } from 'src/modules/system-configuration/system-configuration.service';
import type { ProviderResult } from 'src/domain/interface/provider-result';
import {
  MESSAGING_CONFIG_KEYS,
  MESSAGING_WEBHOOK_PATH,
  normalizePhone,
} from 'src/domain/messaging/messaging.const';
import { appPublicUrl } from 'src/common/utils/app-public-url.util';
import { MessagingConnectionService } from './messaging-connection.service';

/** Resultado do registro do webhook ao salvar uma conexão. Falhar não desfaz a conexão. */
export interface WebhookRegistration {
  registered: boolean;
  url: string;
  message: string;
}

/** O webhook do sistema: chave de acesso, URL pública por conexão e o registro no provider. */
@Injectable()
export class MessagingWebhookService {
  constructor(
    private readonly systemConfig: SystemConfigurationService,
    private readonly connections: MessagingConnectionService,
    private readonly i18n: I18nService,
  ) {}

  async webhookKey(): Promise<string | null> {
    return this.readConfigValue(MESSAGING_CONFIG_KEYS.webhookKey);
  }

  /** Números que o webhook descarta por completo, em dígitos puros. */
  async ignoredPhones(): Promise<Set<string>> {
    const raw = await this.readConfigValue(MESSAGING_CONFIG_KEYS.ignoreList);
    if (!raw) return new Set();
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return new Set();
      return new Set(
        parsed
          .filter((item): item is string => typeof item === 'string')
          .map(normalizePhone)
          .filter(Boolean),
      );
    } catch {
      return new Set();
    }
  }

  /** Registra, no provider, o webhook DESTA conexão — a URL leva o id dela. */
  async registerWebhook(connectionId: string): Promise<ProviderResult> {
    try {
      const provider = this.connections.use(
        await this.connections.get(connectionId),
      );
      return await provider.registerWebhook(
        await this.webhookUrl(connectionId),
      );
    } catch (error) {
      return {
        status: false,
        data: String((error as Error)?.message ?? error),
      };
    }
  }

  /** Registro best-effort: falha não desfaz a conexão; o retorno traz a URL para registro manual. */
  async registerWebhookReport(
    connectionId: string,
  ): Promise<WebhookRegistration> {
    const result = await this.registerWebhook(connectionId);
    // Sem chave configurada não existe URL utilizável (o webhook recusaria tudo); `message` explica.
    const url = await this.webhookUrl(connectionId).catch(() => '');
    return { registered: result.status, url, message: result.data };
  }

  /** URL pública do webhook de uma conexão: chave do sistema + id da conexão. */
  async webhookUrl(connectionId: string): Promise<string> {
    const override = await this.readConfigValue(
      MESSAGING_CONFIG_KEYS.webhookPublicUrl,
    );
    const base = (override || appPublicUrl()).replace(/\/+$/, '');
    const key = await this.readConfigValue(MESSAGING_CONFIG_KEYS.webhookKey);
    if (!key) {
      throw new ServiceUnavailableException(
        this.i18n.t('messaging.webhook_key_missing'),
      );
    }
    const query = new URLSearchParams({ key, connection: connectionId });
    return `${base}${MESSAGING_WEBHOOK_PATH}?${query.toString()}`;
  }

  private async readConfigValue(labelKey: string): Promise<string | null> {
    try {
      const record = await this.systemConfig.findByLabelKey(labelKey);
      const value = record?.value;
      return typeof value === 'string' && value.length > 0 ? value : null;
    } catch (err) {
      if (err instanceof NotFoundException) return null;
      throw err;
    }
  }
}
