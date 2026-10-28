import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const AcceptProposalVersionResponseSchema = z.object({
  proposalId: z.string().uuid(),
  versionId: z.string().uuid(),
  acceptedAt: z.string().datetime(),
  /** `true` quando a versão já estava aceita — operação idempotente, não é erro. */
  alreadyAccepted: z.boolean(),
});

export class AcceptProposalVersionResponseDto extends createZodDto(
  AcceptProposalVersionResponseSchema,
) {}
