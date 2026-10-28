import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UpdateCompanySchema = z
  .object({
    name: z.string().min(1).optional().describe('Company name'),
    tradeName: z.string().optional().describe('Trade name (fantasy name)'),
    taxId: z.string().optional().describe('Tax identifier (CNPJ/CPF)'),
    site: z.string().optional().describe('Website'),
    segment: z.string().optional().describe('Market segment'),
    notes: z.string().optional().describe('Free-text notes'),
  })
  .strict();

export class UpdateCompanyDto extends createZodDto(UpdateCompanySchema) {}
