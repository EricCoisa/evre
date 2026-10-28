import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const RevokeProposalPublicationResponseSchema = z.object({
  proposalId: z.string().uuid(),
  version: z.number().int().optional().nullable(),
  revokedAt: z.string().datetime().optional().nullable(),
  /** `true` quando a versão já estava revogada — operação idempotente, não é erro. */
  alreadyRevoked: z.boolean(),
  message: z.string().optional(),
});

export class RevokeProposalPublicationResponseDto extends createZodDto(
  RevokeProposalPublicationResponseSchema,
) {}
