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
import { MessagingConnectionStateService } from '../messaging-connection-state.service';
import { MessagingEventsService } from '../messaging-events.service';
import { MessagingProviderRegistry } from '../messaging-provider.registry';
import { MessagingService } from '../messaging.service';
import { MessagingWebhookService } from '../messaging-webhook.service';
import { buildConfig } from './connection-config.util';
import type { SaveConnectionResult } from './create-connection.use-case';

/** Restaura uma conexão arquivada: valida provider e credenciais, reativa e re-registra o webhook. */
@Injectable()
export class RestoreConnectionUseCase {
  constructor(
    private readonly connections: MessagingConnectionService,
    private readonly registry: MessagingProviderRegistry,
    private readonly messaging: MessagingService,
    private readonly webhooks: MessagingWebhookService,
    private readonly state: MessagingConnectionStateService,
    private readonly events: MessagingEventsService,
    private readonly systemConfig: SystemConfigurationService,
    private readonly i18n: I18nService,
  ) {}

  async execute(
    id: string,
    dto?: SaveMessagingConnectionDto,
    performedById?: string,
  ): Promise<SaveConnectionResult> {
    const connection = await this.connections.get(id);
    if (!connection.archivedAt) {
      throw new BadRequestException(
        this.i18n.t('messaging.connection_not_archived'),
      );
    }

    if (dto?.provider && dto.provider !== connection.provider) {
      throw new BadRequestException(
        this.i18n.t('messaging.connection_provider_immutable'),
      );
    }

    const { provider } = connection;
    const active = await this.connections.findByProvider(provider);
    if (active) {
      throw new ConflictException(this.i18n.t('messaging.connection_exists'));
    }

    const hasDtoOverrides =
      dto &&
      Object.entries(dto).some(
        ([key, val]) =>
          key !== 'provider' && typeof val === 'string' && val.trim() !== '',
      );

    const config = hasDtoOverrides
      ? buildConfig(
          this.registry.get(provider),
          dto,
          this.connections.plainConfig(connection),
        )
      : this.connections.plainConfig(connection);

    const { result, accountPhone } = await this.messaging.inspectCandidate({
      provider,
      config,
    });
    assertProviderOk(result);

    // Na Meta (ou providers que informam accountPhone): obrigatoriamente deve ser o mesmo número anterior
    if (accountPhone && connection.phone && accountPhone !== connection.phone) {
      throw new BadRequestException(
        this.i18n.t('messaging.connection_phone_mismatch', {
          args: { phone: connection.phone },
        }),
      );
    }

    const encodedConfig = this.connections.encode(provider, config);
    const restored = await this.connections.unarchive(
      id,
      encodedConfig,
      accountPhone ?? undefined,
    );

    if (dto && performedById) {
      await this.saveWebhookOverride(dto, performedById);
    }

    await this.state.reset(id);
    const webhook = await this.webhooks.registerWebhookReport(id);
    this.events.emit({ type: 'connection' });

    return {
      connection: this.connections.view(restored),
      webhook,
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
