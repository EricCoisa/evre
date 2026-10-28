import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UpdateProposalLayoutSchema = z
  .object({
    layout: z
      .record(z.unknown())
      .describe('Layout do PageBuilder (rascunho) — JSON livre nesta etapa'),
  })
  .strict();

export class UpdateProposalLayoutDto extends createZodDto(
  UpdateProposalLayoutSchema,
) {}
