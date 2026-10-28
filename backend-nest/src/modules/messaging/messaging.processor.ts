import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, UnrecoverableError } from 'bullmq';
import { setTimeout as sleep } from 'timers/promises';
import type { SendMessageInput } from 'src/domain/interface/messaging-provider.interface';
import { MessagingNonRetryableError } from './messaging.errors';
import { MessagingService } from './messaging.service';
import {
  MESSAGING_SEND_RETRY_DELAYS_MS,
  SEND_QUEUE_NAMES,
} from './messaging-queue.const';
import { isTransientProviderError } from './providers/provider-http.util';

export interface SendJobData {
  messageId: string;
  /** Só com variável `sensitive`: a linha guarda o texto mascarado e o conteúdo real viaja no job. */
  input?: SendMessageInput;
  /** Aviso de segurança que fura o opt-out; o dispatch reconfere o opt-out e precisa saber disso. */
  bypassOptOut?: boolean;
}

/** Worker de uma partição de envio, processando uma mensagem por vez na ordem em que entrou na fila. */
export abstract class MessagingSendProcessor extends WorkerHost {
  constructor(private readonly messagingService: MessagingService) {
    super();
  }

  async process(job: Job<SendJobData>): Promise<void> {
    const { messageId, input, bypassOptOut } = job.data;
    const delays = MESSAGING_SEND_RETRY_DELAYS_MS;

    for (let attempt = 0; ; attempt += 1) {
      const retriesLeft = delays.length - attempt;
      try {
        await this.messagingService.dispatch(messageId, input, {
          bypassOptOut,
          retriesLeft,
        });
        return;
      } catch (error) {
        // Repetir não muda o resultado ou duplicaria o envio: encerra já.
        if (error instanceof MessagingNonRetryableError) {
          throw new UnrecoverableError(error.message);
        }
        if (retriesLeft <= 0 || !isTransientProviderError(error)) throw error;
        await sleep(delays[attempt]);
      }
    }
  }
}

/** Um processor por fila de envio: o decorator `@Processor` amarra a classe a UMA fila. */
export const SEND_PROCESSORS: Array<
  new (messagingService: MessagingService) => MessagingSendProcessor
> = SEND_QUEUE_NAMES.map((name) => {
  @Processor(name, { concurrency: 1 })
  class PartitionSendProcessor extends MessagingSendProcessor {
    // Explícito de propósito: sem construtor próprio o TypeScript não emite o tipo do parâmetro e o Nest
    // injetaria `undefined` no serviço.
    constructor(messagingService: MessagingService) {
      super(messagingService);
    }
  }
  Object.defineProperty(PartitionSendProcessor, 'name', {
    value: `MessagingSendProcessor_${name}`,
  });
  return PartitionSendProcessor;
});
