import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const schema = z.object({
  entityType: z.enum(['PROJECT', 'MILESTONE', 'TASK']),
  entityId: z.string().uuid(),
  content: z.string().min(1).max(5000),
});

export class CreateCommentDto extends createZodDto(schema) {}
