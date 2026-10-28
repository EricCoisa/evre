import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UpdateContactSchema = z
  .object({
    name: z.string().min(1).optional().describe('Contact name'),
    role: z.string().optional().describe('Role at the company'),
    email: z.string().email().optional().describe('Contact email'),
    phone: z.string().optional().describe('Contact phone'),
    isPrimary: z.boolean().optional(),
    isDecisionMaker: z.boolean().optional(),
    notes: z.string().optional().describe('Free-text notes'),
  })
  .strict();

export class UpdateContactDto extends createZodDto(UpdateContactSchema) {}
