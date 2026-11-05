import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const schema = z.object({
  value: z.string().min(1).max(10000),
});

export class AnswerInfoRequestDto extends createZodDto(schema) {}
