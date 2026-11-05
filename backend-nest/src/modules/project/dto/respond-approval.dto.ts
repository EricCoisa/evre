import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const schema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  responseNote: z.string().max(2000).optional(),
});

export class RespondApprovalDto extends createZodDto(schema) {}
