import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const AcceptProposalOfflineSchema = z
  .object({
    note: z
      .string()
      .min(1)
      .describe('Onde a decisão foi recebida — telefone, reunião, email'),
  })
  .strict();

export class AcceptProposalOfflineDto extends createZodDto(
  AcceptProposalOfflineSchema,
) {}
