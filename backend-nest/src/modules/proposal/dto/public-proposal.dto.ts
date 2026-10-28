import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ProposalRecurrenceConst } from 'src/domain/proposal/proposalRecurrence.const';

export const PublicProposalEnvelopeSchema = z.object({
  totalCents: z.number().int().optional().nullable(),
  currency: z.string(),
  recurrence: z.enum(
    Object.values(ProposalRecurrenceConst) as [string, ...string[]],
  ),
  termDays: z.number().int().optional().nullable(),
  validUntil: z.string().datetime().optional().nullable(),
  includedItems: z.array(z.string()),
  optionalItems: z.array(z.string()),
});

/** Shape exato da tela pública — nunca `ownerId`, `lostReason` nem id de proposta/empresa. */
export const PublicProposalSchema = z.object({
  proposalName: z.string(),
  companyName: z.string().optional().nullable(),
  layout: z.record(z.unknown()),
  envelope: PublicProposalEnvelopeSchema,
  acceptedAt: z.string().datetime().optional().nullable(),
});

export class PublicProposalDto extends createZodDto(PublicProposalSchema) {}
