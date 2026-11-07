import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const schema = z.object({
  requestNote: z.string().max(2000).optional(),
});

export class RequestApprovalDto extends createZodDto(schema) {}
