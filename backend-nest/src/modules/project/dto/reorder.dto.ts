import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ReorderSchema = z
  .object({
    orderedIds: z.array(z.string().uuid()).min(1).describe('IDs in the desired order'),
  })
  .strict();

export class ReorderDto extends createZodDto(ReorderSchema) {}
