import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const ArtifactFileEntrySchema = z.object({
  path: z.string(),
  contentType: z.string(),
  sizeBytes: z.number().int(),
});

export const ArtifactSchema = z.object({
  id: z.string().uuid(),
  name: z.string().optional().nullable(),
  kind: z.enum(['FILE', 'FOLDER']),
  storageKey: z.string(),
  entryFileName: z.string().optional().nullable(),
  fileName: z.string(),
  contentType: z.string().optional().nullable(),
  files: z.array(ArtifactFileEntrySchema),
  sizeBytes: z.number().int(),
  published: z.boolean(),
  public: z.boolean(),
  publicToken: z.string().optional().nullable(),
  createdById: z.string().uuid().optional().nullable(),
  archivedAt: z.string().datetime().optional().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export class ArtifactDto extends createZodDto(ArtifactSchema) {}
