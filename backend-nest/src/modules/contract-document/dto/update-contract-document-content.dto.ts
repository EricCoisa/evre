import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const UpdateContractDocumentContentSchema = z
  .object({
    name: z.string().min(1, 'validation.name.required').optional(),
    content: z.string().min(1, 'validation.content.required'),
  })
  .strict();

export class UpdateContractDocumentContentDto extends createZodDto(
  UpdateContractDocumentContentSchema,
) {}
