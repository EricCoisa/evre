import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { LoggingService } from './logging.service';
import { CreateLogParams } from './dto/create-logging-dto';

@Processor('audit')
export class AuditProcessor extends WorkerHost {
  constructor(private readonly loggingService: LoggingService) {
    super();
  }

  async process(
    job: Job<{ data: CreateLogParams; performedById: string | null }>,
  ) {
    await this.loggingService.writeNow(job.data.data, job.data.performedById);
  }
}
