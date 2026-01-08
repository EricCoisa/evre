import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const CreateProposalSchema = z
  .object({
    companyId: z.string().uuid('validation.company_id.invalid_uuid'),
    name: z.string().min(1, 'validation.name.required'),
    content: z.string().min(1, 'validation.content.required'),
    contentSchemaVersion: z.string().optional().default('v1'),
  })
  .strict();

export class CreateProposalDto extends createZodDto(CreateProposalSchema) {}
