import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ContactSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  messagingContactId: z.string().uuid(),
  role: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  isPrimary: z.boolean(),
  isDecisionMaker: z.boolean(),
  notes: z.string().optional().nullable(),
  archivedAt: z.string().datetime().optional().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  messagingContact: z.object({
    id: z.string().uuid(),
    phone: z.string(),
    name: z.string().optional().nullable(),
    pushName: z.string().optional().nullable(),
    profilePictureUrl: z.string().optional().nullable(),
  }),
});

export class ContactDto extends createZodDto(ContactSchema) {}
