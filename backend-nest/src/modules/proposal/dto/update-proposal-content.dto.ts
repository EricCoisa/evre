import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const UpdateProposalContentSchema = z
  .object({
    content: z.string().min(1, 'validation.content.required'),
  })
  .strict();

export class UpdateProposalContentDto extends createZodDto(
  UpdateProposalContentSchema,
) {}
