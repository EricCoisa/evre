import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ProposalStatusConst } from 'src/domain/proposal/proposalStatus.const';

export const PublishProposalResponseSchema = z.object({
  proposalId: z.string().uuid(),
  version: z.number().int(),
  publicToken: z.string(),
  publicUrl: z.string(),
  publishedAt: z.string().datetime(),
  status: z.enum(Object.values(ProposalStatusConst) as [string, ...string[]]),
});

export class PublishProposalResponseDto extends createZodDto(
  PublishProposalResponseSchema,
) {}
