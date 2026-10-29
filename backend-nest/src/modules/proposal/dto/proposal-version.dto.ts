import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ProposalRecurrenceConst } from 'src/domain/proposal/proposalRecurrence.const';
import { PUBLICATION_STATE_VALUES } from 'src/domain/proposal/publicationState.const';

export const ProposalVersionSchema = z.object({
  id: z.string().uuid(),
  proposalId: z.string().uuid(),
  version: z.number().int(),
  layout: z.record(z.unknown()),
  totalCents: z.number().int().optional().nullable(),
  currency: z.string(),
  recurrence: z.enum(
    Object.values(ProposalRecurrenceConst) as [string, ...string[]],
  ),
  termDays: z.number().int().optional().nullable(),
  validUntil: z.string().datetime().optional().nullable(),
  includedItems: z.array(z.string()),
  optionalItems: z.array(z.string()),
  publicToken: z.string().optional().nullable(),
  publishedAt: z.string().datetime().optional().nullable(),
  revokedAt: z.string().datetime().optional().nullable(),
  createdAt: z.string().datetime(),
  /** Derivado, nunca persistido — ver `derivePublicationState`. */
  state: z.enum(PUBLICATION_STATE_VALUES),
  /** `null` até o primeiro envio por WhatsApp construir o link curto. */
  shortUrl: z.string().optional().nullable(),
  /** `null` sem `publicToken` — URL completa, nunca montada no cliente via `window.location.origin`. */
  publicUrl: z.string().optional().nullable(),
});

export class ProposalVersionDto extends createZodDto(ProposalVersionSchema) {}
