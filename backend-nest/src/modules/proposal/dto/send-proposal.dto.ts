import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const SendProposalSchema = z.object({
  /** Sem telefone, usa o contato principal da empresa (`Contact.isPrimary`). */
  phone: z.string().min(1).optional(),
});

export class SendProposalDto extends createZodDto(SendProposalSchema) {}
