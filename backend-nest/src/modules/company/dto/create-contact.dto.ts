import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { MESSAGING_LIMITS } from 'src/domain/messaging/messaging.const';

export const CreateContactSchema = z
  .object({
    phone: z.string().min(1).max(MESSAGING_LIMITS.phone).describe('Phone (MessagingContact identity)'),
    name: z.string().optional().describe('Contact name; set on MessagingContact when creating'),
    role: z.string().optional().describe('Role at the company'),
    email: z.string().email().optional().describe('Contact email'),
    isPrimary: z.boolean().optional().default(false),
    isDecisionMaker: z.boolean().optional().default(false),
    notes: z.string().optional().describe('Free-text notes'),
  })
  .strict();

export class CreateContactDto extends createZodDto(CreateContactSchema) {}
