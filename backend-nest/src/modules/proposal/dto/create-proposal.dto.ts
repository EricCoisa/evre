import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateProposalSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .describe('Nome da proposta — único campo obrigatório'),
  })
  .strict();

export class CreateProposalDto extends createZodDto(CreateProposalSchema) {}
