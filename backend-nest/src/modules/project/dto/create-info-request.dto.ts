import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const schema = z.object({
  label: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
});

export class CreateInfoRequestDto extends createZodDto(schema) {}
