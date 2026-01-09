import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const CreateClientLogSchema = z
  .object({
    companyId: z.string().uuid(),
    projectId: z.string().uuid(),
    environment: z.string().min(1).max(100),
    metadata: z.string().optional(),
  })
  .strict();

export class CreateClientLogDto extends createZodDto(CreateClientLogSchema) {}
