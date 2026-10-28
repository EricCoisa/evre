import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateContactSchema = z
  .object({
    name: z.string().min(1).describe('Contact name'),
    role: z.string().optional().describe('Role at the company'),
    email: z.string().email().optional().describe('Contact email'),
    phone: z.string().optional().describe('Contact phone'),
    isPrimary: z.boolean().optional().default(false),
    isDecisionMaker: z.boolean().optional().default(false),
    notes: z.string().optional().describe('Free-text notes'),
  })
  .strict();

export class CreateContactDto extends createZodDto(CreateContactSchema) {}
