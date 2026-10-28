import { ConflictException, Injectable, Logger } from '@nestjs/common';
import type { MessagingConnection } from '@prisma/client';
import { I18nService } from 'nestjs-i18n';
import { RedisService } from 'src/common/infrastructure/redis/redis.service';
import type {
  IMessagingProvider,
  IMessagingSession,
  MessagingCapabilities,
  MessagingEvent,
  MessagingSession,
} from 'src/domain/interface/messaging-provider.interface';
import type { ProviderResult } from 'src/domain/interface/provider-result';
import type { MessagingProvider } from 'src/domain/messaging/messaging.const';
import { BadRequestException } from '@nestjs/common';
import { MessagingConnectionService } from './messaging-connection.service';
import { MessagingEventsService } from './messaging-events.service';
import { MessagingProviderRegistry } from './messaging-provider.registry';
import {
  MessagingSessionStore,
  type StoredSession,
} from './messaging-session.store';
import { normalizePhone } from './providers/phone.util';
import type { CapabilityCheckResult } from 'src/domain/capability/capability.types';

const HEALTH_TTL = 300;
const healthKey = (connectionId: string) => `messaging:health:${connectionId}`;

export type SessionView = MessagingSession & { supported: boolean };
export interface Health {
  operational: boolean;
  reason?: string;
}

/** Estado vivo de cada conexão (sessão, saúde, capacidades) e a regra do número fixo no pareamento. */
@Injectable()
export class MessagingConnectionStateService {
  private readonly logger = new Logger(MessagingConnectionStateService.name);

  constructor(
    private readonly connections: MessagingConnectionService,
    private readonly registry: MessagingProviderRegistry,
    private readonly sessionStore: MessagingSessionStore,
    private readonly redis: RedisService,
    private readonly events: MessagingEventsService,
    private readonly i18n: I18nService,
  ) {}

  capabilities(connection: MessagingConnection): MessagingCapabilities & {
    provider: MessagingProvider;
    connectionId: string;
  } {
    return {
      provider: connection.provider,
      connectionId: connection.id,
      ...this.registry.get(connection.provider).messagingCapabilities,
    };
  }

  /** Estado da sessão sem bater no provider a cada consulta; envelhecido, confere uma vez e reaproveita. */
  async status(
    connection: MessagingConnection,
    provider = this.connections.use(connection),
  ): Promise<SessionView> {
    if (!provider.session) return { supported: false, status: 'CONNECTED' };

    const stored = await this.sessionStore.get(connection.id);
    if (stored && this.sessionStore.isFresh(stored)) {
      return { supported: true, ...this.withoutClock(stored) };
    }
    const live = await this.enforceNumber(
      connection,
      provider.session,
      await provider.session.status(),
    );
    const saved = await this.sessionStore.set(connection.id, live);
    return { supported: true, ...this.withoutClock(saved) };
  }

  /** Cria a instância (se preciso), devolve o QR e registra o estado. */
  async connect(connection: MessagingConnection): Promise<MessagingSession> {
    const session = this.requireSession(this.connections.use(connection));
    const connected = await this.enforceNumber(
      connection,
      session,
      await session.connect(),
    );
    await this.sessionStore.set(connection.id, connected);
    await this.invalidateHealth(connection.id);
    this.events.emit({ type: 'connection' });
    return connected;
  }

  /** Desconecta a sessão. A conexão, a config e o número ficam: reconectar é com o mesmo número. */
  async disconnect(connection: MessagingConnection): Promise<ProviderResult> {
    const result = await this.requireSession(
      this.connections.use(connection),
    ).disconnect();
    await this.reset(connection.id);
    this.events.emit({ type: 'connection' });
    return result;
  }

  /** Push do provider (`connection.update`, `qrcode.updated`): grava e derruba o health em cache. */
  async applyEvent(
    connection: MessagingConnection,
    event: Extract<MessagingEvent, { kind: 'CONNECTION' }>,
  ): Promise<void> {
    const { kind: _kind, ...pushed } = event;
    const previous = await this.sessionStore.get(connection.id);
    let session: MessagingSession = pushed;

    if (event.status === 'CONNECTED') {
      // O evento não traz o número: confere no provider para aplicar a regra do número fixo.
      session = await this.withPairedNumber(connection, session);
    } else if (event.status === 'DISCONNECTED' && previous?.error) {
      // O desfazer de um pareamento recusado dispara o seu próprio "desconectou": não apaga o motivo.
      session = {
        ...session,
        error: previous.error,
        expectedPhone: previous.expectedPhone,
      };
    }

    await this.sessionStore.set(connection.id, session);
    await this.invalidateHealth(connection.id);
    this.events.emit({ type: 'connection' });
  }

  /** Saudável = credencial válida E, nos providers com sessão (WhatsApp Web), instância conectada. */
  async health(connection: MessagingConnection): Promise<Health> {
    const cached = await this.redis.get(healthKey(connection.id));
    if (cached !== null) return JSON.parse(cached) as Health;

    const result = await this.liveHealth(connection);
    await this.redis.set(
      healthKey(connection.id),
      JSON.stringify(result),
      HEALTH_TTL,
    );
    return result;
  }

  /** Pelo menos uma conexão não arquivada operacional. Sem conexão nenhuma, falha. Não cacheado:
   *  soma healths que já têm cache próprio. */
  async checkAnyOperational(): Promise<CapabilityCheckResult> {
    const connections = await this.connections.list();
    if (connections.length === 0) {
      return {
        operational: false,
        reason: this.i18n.t('messaging.no_connection'),
      };
    }
    let lastReason: string | undefined;
    for (const connection of connections) {
      const health = await this.health(connection);
      if (health.operational) return { operational: true };
      lastReason = health.reason;
    }
    return { operational: false, reason: lastReason };
  }

  async invalidateHealth(connectionId: string): Promise<void> {
    await this.redis.del(healthKey(connectionId));
  }

  /** Configuração mudou: o estado e o health guardados eram da configuração anterior. */
  async reset(connectionId: string): Promise<void> {
    await this.sessionStore.clear(connectionId);
    await this.invalidateHealth(connectionId);
  }

  private async liveHealth(connection: MessagingConnection): Promise<Health> {
    if (connection.archivedAt) {
      return {
        operational: false,
        reason: this.i18n.t('messaging.connection_archived'),
      };
    }
    try {
      const provider = this.connections.use(connection);
      const credentials = await provider.validateConfiguration();
      if (!credentials.status) {
        return { operational: false, reason: credentials.data };
      }

      if (!provider.session) {
        await this.bindAccountPhone(connection, provider);
        return { operational: true };
      }

      const session = await this.status(connection, provider);
      if (session.status === 'CONNECTED') return { operational: true };
      return {
        operational: false,
        reason: this.i18n.t(
          `messaging.session_${session.error ?? session.status}`,
          {
            args: { phone: session.expectedPhone ?? '' },
          },
        ),
      };
    } catch (error) {
      return {
        operational: false,
        reason: String((error as Error)?.message ?? error),
      };
    }
  }

  /** Provider sem QR (Meta): o número vem da conta; fixa na primeira checagem se ainda não estava. */
  private async bindAccountPhone(
    connection: MessagingConnection,
    provider: IMessagingProvider,
  ): Promise<void> {
    if (connection.phone || !provider.accountPhone) return;
    try {
      const phone = await provider.accountPhone();
      if (phone) await this.connections.bindPhone(connection.id, phone);
    } catch (error) {
      this.logger.warn(
        `Número da conexão ${connection.id} não vinculado: ${String((error as Error)?.message ?? error)}`,
      );
    }
  }

  /** Fixa/confere o número no pareamento. Sem número no evento, pergunta ao provider. */
  private async withPairedNumber(
    connection: MessagingConnection,
    session: MessagingSession,
  ): Promise<MessagingSession> {
    const provider = this.connections.use(connection);
    if (!provider.session) return session;
    try {
      let live = session;
      if (!session.phoneNumber) {
        const fresh = await provider.session.status();
        // Provider que ainda não acompanhou o evento: vale o que o evento disse.
        if (fresh.status === 'CONNECTED') live = { ...session, ...fresh };
      }
      return this.enforceNumber(connection, provider.session, live);
    } catch (error) {
      this.logger.warn(
        `Número pareado da conexão ${connection.id} não conferido: ${String((error as Error)?.message ?? error)}`,
      );
      return session;
    }
  }

  /** A regra do número: primeiro pareamento fixa; depois, sessão de outro número é desfeita. */
  private async enforceNumber(
    connection: MessagingConnection,
    session: IMessagingSession,
    live: MessagingSession,
  ): Promise<MessagingSession> {
    if (live.status !== 'CONNECTED' || !live.phoneNumber) return live;
    const paired = normalizePhone(live.phoneNumber);

    if (!connection.phone) {
      try {
        await this.connections.bindPhone(connection.id, paired);
        return live;
      } catch (error) {
        if (!(error instanceof ConflictException)) throw error;
        const msg = String((error as Error)?.message ?? '');
        const isArchived =
          msg.includes('arquivada') || msg.includes('archived');
        return this.undoPairing(
          session,
          isArchived ? 'PHONE_ARCHIVED' : 'PHONE_IN_USE',
          undefined,
        );
      }
    }

    return paired === connection.phone
      ? live
      : this.undoPairing(session, 'PHONE_MISMATCH', connection.phone);
  }

  private async undoPairing(
    session: IMessagingSession,
    error: 'PHONE_MISMATCH' | 'PHONE_IN_USE' | 'PHONE_ARCHIVED',
    expectedPhone: string | undefined,
  ): Promise<MessagingSession> {
    await session
      .disconnect()
      .catch((failure: unknown) =>
        this.logger.warn(
          `Não foi possível desfazer o pareamento recusado: ${String((failure as Error)?.message ?? failure)}`,
        ),
      );
    return { status: 'DISCONNECTED', error, expectedPhone };
  }

  private requireSession(provider: IMessagingProvider): IMessagingSession {
    if (!provider.session) {
      throw new BadRequestException(
        this.i18n.t('messaging.session_not_supported'),
      );
    }
    return provider.session;
  }

  /** O relógio do store é interno: a API devolve só o estado da sessão. */
  private withoutClock(stored: StoredSession): MessagingSession {
    const { updatedAt: _updatedAt, ...session } = stored;
    return session;
  }
}
