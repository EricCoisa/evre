import { describe, it, expect, vi, afterEach } from 'vitest';
import { Logger } from '@nestjs/common';
import type { RedisService } from '../../../common/infrastructure/redis/redis.service';
import type { LoggingService } from '../../logging/logging.service';
import type { AiStreamEvent } from 'src/domain/interface/ai-provider.interface';
import { runConversationTurn } from './run-conversation-turn';

/** Redis em memória com `set` controlável, para expor corrida entre refresh e release. */
function fakeRedis() {
  const store = new Set<string>();
  let releasePendingSet: (() => void) | undefined;

  return {
    store,
    /** Conclui o `set` que ficou em voo (simula a resposta do Redis chegando depois). */
    flushPendingSet() {
      releasePendingSet?.();
      releasePendingSet = undefined;
    },
    service: {
      setnx: (key: string) => {
        if (store.has(key)) return Promise.resolve(false);
        store.add(key);
        return Promise.resolve(true);
      },
      // Fica pendente até `flushPendingSet()` — é a janela da corrida.
      set: (key: string) =>
        new Promise<void>((resolve) => {
          releasePendingSet = () => {
            store.add(key);
            resolve();
          };
        }),
      del: (key: string) => {
        store.delete(key);
        return Promise.resolve();
      },
    } as unknown as RedisService,
  };
}

const loggingService = {
  create: vi.fn().mockResolvedValue(undefined),
} as unknown as LoggingService;

/** Pool fake — lock/unlock resolvem na hora, só registra as queries pra asserção. */
function fakePgPool() {
  const queries: Array<{ text: string; values?: unknown[] }> = [];
  return {
    queries,
    pool: {
      connect: () =>
        Promise.resolve({
          query: (text: string, values?: unknown[]) => {
            queries.push({ text, values });
            return Promise.resolve(undefined);
          },
          release: () => {},
        }),
    },
  };
}

describe('runConversationTurn — liberação do lock', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('leaves no lock behind when the TTL refresh lands after the release', async () => {
    vi.useFakeTimers();
    const redis = fakeRedis();
    const pgPool = fakePgPool();

    let releaseTurn!: () => void;
    const turnGate = new Promise<void>((resolve) => {
      releaseTurn = resolve;
    });

    const turn = (async () => {
      const events: AiStreamEvent[] = [];
      for await (const event of runConversationTurn({
        redis: redis.service,
        pgPool: pgPool.pool,
        loggingService,
        logger: new Logger('test'),
        conversationId: 'c1',
        userId: 'u1',
        run: async function* () {
          yield { type: 'text', text: 'parcial' } as AiStreamEvent;
          await turnGate; // turno longo: o refresh do TTL vai disparar
          yield { type: 'done' } as AiStreamEvent;
        },
      })) {
        events.push(event);
      }
      return events;
    })();

    // Passa dos 30s (metade do TTL): o refresh dispara e fica em voo.
    await vi.advanceTimersByTimeAsync(31_000);
    expect(redis.store.has('ai:conv:c1:lock')).toBe(true);

    // Turno termina enquanto aquele SET ainda está em voo.
    releaseTurn();
    // A resposta do Redis chega depois — é exatamente a janela da corrida.
    // (O turno só consegue terminar porque o release espera esse SET.)
    await vi.advanceTimersByTimeAsync(0);
    redis.flushPendingSet();
    await turn;

    // Estado final: sem lock. Antes do fix, o SET atrasado recriava a chave
    // depois do DEL e a conversa ficava travada até o TTL.
    expect(redis.store.has('ai:conv:c1:lock')).toBe(false);
  });
});

describe('runConversationTurn — advisory lock do Postgres', () => {
  it('adquire e solta o advisory lock ao redor do turno', async () => {
    const redis = fakeRedis();
    const pgPool = fakePgPool();

    const events: AiStreamEvent[] = [];
    for await (const event of runConversationTurn({
      redis: redis.service,
      pgPool: pgPool.pool,
      loggingService,
      logger: new Logger('test'),
      conversationId: 'c1',
      userId: 'u1',
      run: async function* () {
        yield { type: 'text', text: 'oi' } as AiStreamEvent;
        yield { type: 'done' } as AiStreamEvent;
      },
    })) {
      events.push(event);
    }

    expect(pgPool.queries).toEqual([
      {
        text: 'SELECT pg_advisory_lock(hashtext($1)::bigint)',
        values: ['c1'],
      },
      {
        text: 'SELECT pg_advisory_unlock(hashtext($1)::bigint)',
        values: ['c1'],
      },
    ]);
  });

  it('solta o advisory lock mesmo quando o turno lança', async () => {
    const redis = fakeRedis();
    const pgPool = fakePgPool();

    async function drain() {
      const events: AiStreamEvent[] = [];
      for await (const event of runConversationTurn({
        redis: redis.service,
        pgPool: pgPool.pool,
        loggingService,
        logger: new Logger('test'),
        conversationId: 'c1',
        userId: 'u1',
        run: async function* () {
          throw new Error('provider explodiu');
        },
      })) {
        events.push(event);
      }
      return events;
    }

    await expect(drain()).rejects.toThrow('provider explodiu');
    expect(pgPool.queries.map((q) => q.text)).toEqual([
      'SELECT pg_advisory_lock(hashtext($1)::bigint)',
      'SELECT pg_advisory_unlock(hashtext($1)::bigint)',
    ]);
  });
});
