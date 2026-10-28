import { ConflictException, Logger } from '@nestjs/common';
import type { RedisService } from '../../../common/infrastructure/redis/redis.service';
import type { LoggingService } from '../../logging/logging.service';
import type { AiStreamEvent } from 'src/domain/interface/ai-provider.interface';
import { LogActions } from 'src/domain/logging/log-actions';

/** Nº de idas ao modelo permitidas num turno — teto do loop agent→tools→agent. */
export const MAX_TOOL_ITERATIONS = 10;

const CONV_LOCK_TTL = 60;
const CONV_LOCK_REFRESH_MS = (CONV_LOCK_TTL / 2) * 1000;

/** Subconjunto do `pg.Pool` do checkpointer usado pelo advisory lock, sem depender do pacote `pg`. */
export interface ConversationLockPool {
  connect(): Promise<{
    query(text: string, values?: unknown[]): Promise<unknown>;
    release(): void;
  }>;
}

/** Envelope de um turno de conversa: segura o lock (Redis + advisory lock do Postgres) e registra a conclusão em log. */
export async function* runConversationTurn(params: {
  redis: RedisService;
  pgPool: ConversationLockPool;
  loggingService: LoggingService;
  logger: Logger;
  conversationId: string;
  userId: string;
  run: () => AsyncGenerator<AiStreamEvent>;
}): AsyncGenerator<AiStreamEvent> {
  const { redis, pgPool, loggingService, logger, conversationId, userId } =
    params;
  const lockKey = `ai:conv:${conversationId}:lock`;

  const lockAcquired = await redis.setnx(lockKey, '1', CONV_LOCK_TTL);
  if (!lockAcquired) throw new ConflictException('Conversa em uso');

  // Renova o TTL do lock por intervalo, esperando o último refresh terminar antes de soltar a chave.
  let refreshInFlight: Promise<void> = Promise.resolve();
  const lockRefresh = setInterval(() => {
    refreshInFlight = redis
      .set(lockKey, '1', CONV_LOCK_TTL)
      .catch((err: unknown) => {
        logger.warn(
          `Falha ao renovar o lock da conversa ${conversationId}: ${String((err as Error)?.message ?? err)}`,
        );
      });
  }, CONV_LOCK_REFRESH_MS);

  try {
    const pgClient = await pgPool.connect();
    try {
      // hashtext: o advisory lock exige chave numérica. Colisão só serializa duas conversas à toa.
      await pgClient.query('SELECT pg_advisory_lock(hashtext($1)::bigint)', [
        conversationId,
      ]);
      try {
        let sawApprovalOrError = false;
        // Único registro do consumo de tokens do turno; o checkpoint guarda mensagens, não usage.
        let usage: { inputTokens: number; outputTokens: number } | undefined;

        for await (const event of params.run()) {
          if (event.type === 'approval_required' || event.type === 'error') {
            sawApprovalOrError = true;
          }
          if (event.type === 'done' && event.usage) usage = event.usage;
          yield event;
        }

        if (!sawApprovalOrError) {
          await loggingService.create(
            {
              module: 'AI',
              action: LogActions.AI_MESSAGE_SENT,
              message: 'Mensagem de IA enviada',
              metadata: { conversationId, ...(usage ? { usage } : {}) },
            },
            userId,
          );
        }
      } finally {
        await pgClient
          .query('SELECT pg_advisory_unlock(hashtext($1)::bigint)', [
            conversationId,
          ])
          .catch((err: unknown) => {
            logger.warn(
              `Falha ao soltar o advisory lock da conversa ${conversationId}: ${String((err as Error)?.message ?? err)}`,
            );
          });
      }
    } finally {
      pgClient.release();
    }
  } finally {
    clearInterval(lockRefresh);
    // Ordem obrigatória: o DEL só pode rodar depois que o último refresh
    // terminou, senão ele apaga uma chave que o SET em voo vai recriar.
    await refreshInFlight;
    // Não deixa uma falha ao soltar o lock mascarar o erro real do turno — o
    // TTL solta sozinho no pior caso.
    await redis.del(lockKey).catch((err: unknown) => {
      logger.warn(
        `Falha ao liberar o lock da conversa ${conversationId}: ${String((err as Error)?.message ?? err)}`,
      );
    });
  }
}
