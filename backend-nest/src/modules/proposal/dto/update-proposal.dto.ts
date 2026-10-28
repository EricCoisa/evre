import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UpdateProposalSchema = z
  .object({
    name: z.string().min(1).optional().describe('Nome da proposta'),
    companyId: z
      .string()
      .uuid()
      .nullable()
      .optional()
      .describe('Empresa vinculada — null desvincula'),
  })
  .strict();

export class UpdateProposalDto extends createZodDto(UpdateProposalSchema) {}
