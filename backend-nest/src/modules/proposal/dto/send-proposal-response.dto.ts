import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const SendProposalResponseSchema = z.object({
  proposalId: z.string().uuid(),
  versionId: z.string().uuid(),
  /** `false` quando o canal falhou — não é erro da rota; a URL abaixo segue valendo para envio manual. */
  succeeded: z.boolean(),
  toPhone: z.string(),
  shortUrl: z.string(),
});

export class SendProposalResponseDto extends createZodDto(
  SendProposalResponseSchema,
) {}
