import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ProposalStatusConst } from 'src/domain/proposal/proposalStatus.const';

const statusValues = Object.values(ProposalStatusConst) as [
  string,
  ...string[],
];

export const UpdateProposalStatusSchema = z
  .object({
    status: z.enum(statusValues),
    lostReason: z
      .string()
      .min(1)
      .optional()
      .describe('Obrigatório quando status é LOST'),
  })
  .strict();

export class UpdateProposalStatusDto extends createZodDto(
  UpdateProposalStatusSchema,
) {}
