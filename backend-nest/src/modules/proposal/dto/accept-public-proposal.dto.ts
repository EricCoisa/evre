import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const AcceptPublicProposalSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .describe('Nome de quem está aceitando — identidade disponível no link'),
    email: z.string().email().describe('Email de quem está aceitando'),
  })
  .strict();

export class AcceptPublicProposalDto extends createZodDto(
  AcceptPublicProposalSchema,
) {}
