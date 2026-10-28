import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ProposalRecurrenceConst } from 'src/domain/proposal/proposalRecurrence.const';

const recurrenceValues = Object.values(ProposalRecurrenceConst) as [
  string,
  ...string[],
];

export const UpdateProposalTermsSchema = z
  .object({
    totalCents: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .nullable()
      .describe('Valor total em centavos — nunca float'),
    currency: z.string().length(3).optional().describe('ISO 4217, ex. BRL'),
    recurrence: z.enum(recurrenceValues).optional(),
    termDays: z.number().int().positive().optional().nullable(),
    // string ISO, não `z.coerce.date()` — este último não aparece no OpenAPI gerado (o
    // conversor zod-to-openapi do nestjs-zod não sabe representar `coerce.date()`, e o campo
    // desaparece em silêncio do client do Orval). Mesmo padrão de `ProposalDto.validUntil`.
    validUntil: z.string().datetime().optional().nullable(),
    includedItems: z.array(z.string()).optional(),
    optionalItems: z.array(z.string()).optional(),
  })
  .strict();

export class UpdateProposalTermsDto extends createZodDto(
  UpdateProposalTermsSchema,
) {}
