import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const CreateContractDocumentSchema = z
  .object({
    projectId: z.string().uuid('validation.project_id.invalid_uuid'),
    proposalId: z
      .string()
      .uuid('validation.proposal_id.invalid_uuid')
      .optional(),
    name: z.string().min(1, 'validation.name.required'),
    content: z.string().min(1, 'validation.content.required'),
    contentSchemaVersion: z.string().optional().default('v1'),
  })
  .strict();

export class CreateContractDocumentDto extends createZodDto(
  CreateContractDocumentSchema,
) {}
