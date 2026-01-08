import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const CreateCommentSchema = z
  .object({
    projectId: z.string().uuid(),
    entityType: z.enum(['PROJECT', 'STAGE', 'ACTIVITY']),
    entityId: z.string().uuid(),
    content: z.string().min(1),
  })
  .strict();

export class CreateCommentDto extends createZodDto(CreateCommentSchema) {}
