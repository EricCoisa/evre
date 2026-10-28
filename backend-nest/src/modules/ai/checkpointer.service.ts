import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import type { ConversationLockPool } from './use-cases/run-conversation-turn';

const CHECKPOINT_SCHEMA = 'langgraph';

/** Checkpointer LangGraph no schema `langgraph`: fonte da verdade da execução da conversa. */
@Injectable()
export class AiCheckpointerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AiCheckpointerService.name);
  readonly saver: PostgresSaver;

  constructor(config: ConfigService) {
    const connString = config.get<string>('DATABASE_URL');
    if (!connString) {
      throw new Error(
        'DATABASE_URL não configurada — checkpointer não pode iniciar',
      );
    }
    this.saver = PostgresSaver.fromConnString(connString, {
      schema: CHECKPOINT_SCHEMA,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.saver.setup();
    this.logger.log(
      `Checkpointer Postgres pronto (schema "${CHECKPOINT_SCHEMA}")`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.saver.end();
  }

  /** Pool `pg` do `PostgresSaver`, exposto para o advisory lock de conversa. */
  get pool(): ConversationLockPool {
    return (this.saver as unknown as { pool: ConversationLockPool }).pool;
  }
}
