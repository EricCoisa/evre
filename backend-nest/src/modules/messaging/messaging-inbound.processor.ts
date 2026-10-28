import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { MessagingService } from './messaging.service';
import { MessagingConnectionService } from './messaging-connection.service';
import { MESSAGING_QUEUE } from './messaging-queue.const';

/** Normaliza e persiste fora do ciclo da request — o webhook já respondeu 200. */
@Processor(MESSAGING_QUEUE.INBOUND)
export class MessagingInboundProcessor extends WorkerHost {
  constructor(
    private readonly messagingService: MessagingService,
    private readonly connections: MessagingConnectionService,
  ) {
    super();
  }

  async process(job: Job<{ connectionId?: string; body: unknown }>) {
    // Job enfileirado antes das conexões existirem não leva o id: resolve como o webhook antigo.
    const connectionId =
      job.data.connectionId ?? (await this.connections.resolve()).id;
    return this.messagingService.ingest(connectionId, job.data.body);
  }
}
