import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ProposalArtifactSchema = z.object({
  id: z.string().uuid(),
  proposalId: z.string().uuid(),
  storageKey: z.string(),
  fileName: z.string(),
  contentType: z.string(),
  sizeBytes: z.number().int(),
  createdById: z.string().uuid().optional().nullable(),
  archivedAt: z.string().datetime().optional().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export class ProposalArtifactDto extends createZodDto(ProposalArtifactSchema) {}
