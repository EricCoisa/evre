import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ApprovalRequestSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().optional().nullable(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export class ApprovalRequestDto extends createZodDto(ApprovalRequestSchema) {}
