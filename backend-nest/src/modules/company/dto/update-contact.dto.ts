import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UpdateContactSchema = z
  .object({
    role: z.string().optional().describe('Role at the company'),
    email: z.string().email().optional().describe('Contact email'),
    isPrimary: z.boolean().optional(),
    isDecisionMaker: z.boolean().optional(),
    notes: z.string().optional().describe('Free-text notes'),
  })
  .strict();

export class UpdateContactDto extends createZodDto(UpdateContactSchema) {}
