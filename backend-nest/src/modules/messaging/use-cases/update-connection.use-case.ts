import { BadRequestException, Injectable } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { assertProviderOk } from 'src/common/utils/provider-result.util';
import { SystemConfigurationService } from 'src/modules/system-configuration/system-configuration.service';
import { MESSAGING_CONFIG_KEYS } from 'src/domain/messaging/messaging.const';
import type { SaveMessagingConnectionDto } from '../dto/messaging-connection.dto';
import { MessagingConnectionService } from '../messaging-connection.service';
import { MessagingConnectionStateService } from '../messaging-connection-state.service';
import { MessagingProviderRegistry } from '../messaging-provider.registry';
import { MessagingService } from '../messaging.service';
import { MessagingWebhookService } from '../messaging-webhook.service';
import { buildConfig } from './connection-config.util';
import type { SaveConnectionResult } from './create-connection.use-case';

/** Edita as credenciais de uma conexão; credenciais que acessem OUTRO número são recusadas. */
@Injectable()
export class UpdateConnectionUseCase {
  constructor(
    private readonly connections: MessagingConnectionService,
    private readonly registry: MessagingProviderRegistry,
    private readonly messaging: MessagingService,
    private readonly webhooks: MessagingWebhookService,
    private readonly state: MessagingConnectionStateService,
    private readonly systemConfig: SystemConfigurationService,
    private readonly i18n: I18nService,
  ) {}

  async execute(
    id: string,
    dto: SaveMessagingConnectionDto,
    performedById: string,
  ): Promise<SaveConnectionResult> {
    const connection = await this.connections.getActive(id);
    if (dto.provider && dto.provider !== connection.provider) {
      throw new BadRequestException(
        this.i18n.t('messaging.connection_provider_immutable'),
      );
    }

    const { provider } = connection;
    const config = buildConfig(
      this.registry.get(provider),
      dto,
      this.connections.plainConfig(connection),
    );
    const { result, accountPhone } = await this.messaging.inspectCandidate({
      provider,
      config,
    });
    assertProviderOk(result);

    if (accountPhone && connection.phone && accountPhone !== connection.phone) {
      throw new BadRequestException(
        this.i18n.t('messaging.connection_phone_mismatch', {
          args: { phone: connection.phone },
        }),
      );
    }

    let updated = await this.connections.updateConfig(
      id,
      this.connections.encode(provider, config),
    );
    if (accountPhone && !connection.phone) {
      updated = await this.connections.bindPhone(id, accountPhone);
    }
    await this.saveWebhookOverride(dto, performedById);
    // Credenciais novas: o estado e o health guardados eram dos antigos.
    await this.state.reset(id);

    return {
      connection: this.connections.view(updated),
      webhook: await this.webhooks.registerWebhookReport(id),
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
