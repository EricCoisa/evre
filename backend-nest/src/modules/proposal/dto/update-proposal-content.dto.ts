import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const UpdateProposalContentSchema = z
  .object({
    name: z.string().min(1, 'validation.name.required').optional(),
    content: z.string().min(1, 'validation.content.required'),
  })
  .strict();

export class UpdateProposalContentDto extends createZodDto(
  UpdateProposalContentSchema,
) {}

const UpdateProposalProjectSchema = z
  .object({
    projectId: z.string().uuid('validation.projectId.invalid'),
  })
  .strict();

export class UpdateProposalProjectDto extends createZodDto(
  UpdateProposalProjectSchema,
) {}
