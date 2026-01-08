import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const StatusResponseSchema = z.object({
  status: z.boolean(),
  message: z.string(),
});

export class StatusResponseDto extends createZodDto(StatusResponseSchema) {}
