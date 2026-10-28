import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { assertProviderOk } from 'src/common/utils/provider-result.util';
import { SystemConfigurationService } from 'src/modules/system-configuration/system-configuration.service';
import { MESSAGING_CONFIG_KEYS } from 'src/domain/messaging/messaging.const';
import type { SaveMessagingConnectionDto } from '../dto/messaging-connection.dto';
import { MessagingConnectionService } from '../messaging-connection.service';
import { MessagingProviderRegistry } from '../messaging-provider.registry';
import { MessagingService } from '../messaging.service';
import {
  MessagingWebhookService,
  type WebhookRegistration,
} from '../messaging-webhook.service';
import type { ConnectionView } from '../messaging-connection.service';
import { buildConfig } from './connection-config.util';

export interface SaveConnectionResult {
  connection: ConnectionView;
  webhook: WebhookRegistration;
}

/** Cria a conexão de um provider: valida as credenciais no provider real e só então grava. */
@Injectable()
export class CreateConnectionUseCase {
  constructor(
    private readonly connections: MessagingConnectionService,
    private readonly registry: MessagingProviderRegistry,
    private readonly messaging: MessagingService,
    private readonly webhooks: MessagingWebhookService,
    private readonly systemConfig: SystemConfigurationService,
    private readonly i18n: I18nService,
  ) {}

  async execute(
    dto: SaveMessagingConnectionDto,
    performedById: string,
  ): Promise<SaveConnectionResult> {
    const { provider } = dto;
    if (!provider) {
      throw new BadRequestException(this.i18n.t('messaging.provider_required'));
    }
    if (await this.connections.findByProvider(provider)) {
      throw new ConflictException(this.i18n.t('messaging.connection_exists'));
    }

    const config = buildConfig(this.registry.get(provider), dto);
    const { result, accountPhone } = await this.messaging.inspectCandidate({
      provider,
      config,
    });
    assertProviderOk(result);

    const connection = await this.connections.create(
      provider,
      this.connections.encode(provider, config),
      accountPhone,
    );
    await this.saveWebhookOverride(dto, performedById);

    return {
      connection: this.connections.view(connection),
      webhook: await this.webhooks.registerWebhookReport(connection.id),
    };
  }

  private async saveWebhookOverride(
    dto: SaveMessagingConnectionDto,
    performedById: string,
  ): Promise<void> {
    if (dto.webhookPublicUrl === undefined) return;
    await this.systemConfig.setManyByLabelKey(
      [
        {
          labelKey: MESSAGING_CONFIG_KEYS.webhookPublicUrl,
          value: dto.webhookPublicUrl,
        },
      ],
      performedById,
    );
  }
}
