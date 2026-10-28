import { Injectable } from '@nestjs/common';
import { RedisService } from 'src/common/infrastructure/redis/redis.service';
import type { MessagingSession } from 'src/domain/interface/messaging-provider.interface';

const keyOf = (connectionId: string) => `messaging:session:${connectionId}`;
/** O estado só some se ninguém falar com o provider por um dia; a frescor real é `isFresh`. */
const TTL_SECONDS = 24 * 60 * 60;

/** Até quando o estado empurrado pelo webhook vale sem conferir no provider. */
const FRESH_MS = 5 * 60 * 1000;

export interface StoredSession extends MessagingSession {
  updatedAt: number;
}

/** Estado da sessão por conexão, alimentado por push (webhook); tela/health leem sem chamar o provider. */
@Injectable()
export class MessagingSessionStore {
  constructor(private readonly redis: RedisService) {}

  async get(connectionId: string): Promise<StoredSession | null> {
    const raw = await this.redis.get(keyOf(connectionId));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StoredSession;
    } catch {
      return null;
    }
  }

  /** QR e código só valem enquanto pareia; ao mudar para outro estado somem. */
  async set(
    connectionId: string,
    next: MessagingSession,
  ): Promise<StoredSession> {
    const pairing =
      next.status === 'CONNECTING'
        ? {
            ...(next.qrCode ? { qrCode: next.qrCode } : {}),
            ...(next.pairingCode ? { pairingCode: next.pairingCode } : {}),
          }
        : {};

    const stored: StoredSession = {
      status: next.status,
      ...(next.phoneNumber ? { phoneNumber: next.phoneNumber } : {}),
      ...(next.error
        ? { error: next.error, expectedPhone: next.expectedPhone }
        : {}),
      ...pairing,
      updatedAt: Date.now(),
    };
    await this.redis.set(
      keyOf(connectionId),
      JSON.stringify(stored),
      TTL_SECONDS,
    );
    return stored;
  }

  async clear(connectionId: string): Promise<void> {
    await this.redis.del(keyOf(connectionId));
  }

  isFresh(stored: StoredSession, now = Date.now()): boolean {
    return now - stored.updatedAt < FRESH_MS;
  }
}
