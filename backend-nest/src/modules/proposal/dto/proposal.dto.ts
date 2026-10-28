import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ProposalStatusConst } from 'src/domain/proposal/proposalStatus.const';
import { ProposalRecurrenceConst } from 'src/domain/proposal/proposalRecurrence.const';

export const ProposalSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid().optional().nullable(),
  ownerId: z.string().uuid(),
  name: z.string(),
  status: z.enum(Object.values(ProposalStatusConst) as [string, ...string[]]),
  lostReason: z.string().optional().nullable(),
  layout: z.record(z.unknown()).optional().nullable(),
  totalCents: z.number().int().optional().nullable(),
  currency: z.string(),
  recurrence: z.enum(
    Object.values(ProposalRecurrenceConst) as [string, ...string[]],
  ),
  termDays: z.number().int().optional().nullable(),
  validUntil: z.string().datetime().optional().nullable(),
  includedItems: z.array(z.string()),
  optionalItems: z.array(z.string()),
  archivedAt: z.string().datetime().optional().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  /** Só a listagem preenche — dias desde `updatedAt`, usado para ordenar "o que está parado". */
  daysWithoutMovement: z.number().int().optional(),
  /** Só a listagem preenche — nome da empresa vinculada, resolvido via join. */
  companyName: z.string().optional().nullable(),
});

export class ProposalDto extends createZodDto(ProposalSchema) {}
