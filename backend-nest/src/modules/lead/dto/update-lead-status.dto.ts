import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UpdateLeadStatusSchema = z
  .object({
    status: z.enum(['NEW', 'VIEWED', 'RESOLVED']),
  })
  .strict();

export class UpdateLeadStatusDto extends createZodDto(UpdateLeadStatusSchema) {}
