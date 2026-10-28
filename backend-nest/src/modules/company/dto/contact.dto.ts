import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ContactSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  name: z.string(),
  role: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  isPrimary: z.boolean(),
  isDecisionMaker: z.boolean(),
  notes: z.string().optional().nullable(),
  archivedAt: z.string().datetime().optional().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export class ContactDto extends createZodDto(ContactSchema) {}
