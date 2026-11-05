import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const MyMembershipSchema = z.object({
  canSeeCommercials: z.boolean(),
  canComment: z.boolean(),
});

export const CompanySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  tradeName: z.string().optional().nullable(),
  taxId: z.string().optional().nullable(),
  site: z.string().optional().nullable(),
  segment: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  archivedAt: z.string().datetime().optional().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  myMembership: MyMembershipSchema.optional(),
});

export class CompanyDto extends createZodDto(CompanySchema) {}
