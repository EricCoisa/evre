import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { MessagingButtonEventService } from './messaging-button-events.service';
import { MESSAGING_QUEUE } from './messaging-queue.const';

/** Roda os handlers de um toque de botão, fora da ingestão do webhook. */
@Processor(MESSAGING_QUEUE.BUTTONS)
export class MessagingButtonProcessor extends WorkerHost {
  constructor(private readonly events: MessagingButtonEventService) {
    super();
  }

  async process(job: Job<{ eventId: string }>) {
    await this.events.process(job.data.eventId);
  }
}
