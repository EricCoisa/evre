import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ListTimeEntriesSchema = z
  .object({
    page: z
      .union([z.string(), z.number()])
      .optional()
      .transform((v) => {
        const n = v ? Number(v) : NaN;
        return Number.isInteger(n) && n >= 1 ? n : 1;
      }),
    limit: z
      .union([z.string(), z.number()])
      .optional()
      .transform((v) => {
        const n = v ? Number(v) : NaN;
        return Number.isInteger(n) ? Math.min(Math.max(n, 1), 50) : 20;
      }),
    pagination: z.union([z.boolean(), z.string()]).optional(),
    search: z.string().trim().optional(),
    filter: z
      .string()
      .optional()
      .describe('Filtros em JSON string gerados pelo DataTable'),
    startDate: z
      .string()
      .optional()
      .describe('Data de início para filtro (ISO ou YYYY-MM-DD)'),
    endDate: z
      .string()
      .optional()
      .describe('Data final para filtro (ISO ou YYYY-MM-DD)'),
    projectId: z.string().optional().describe('Filtrar por ID do projeto'),
    userId: z
      .string()
      .optional()
      .describe('Filtrar por ID do usuário (restrito a ADMIN)'),
    entityType: z.string().optional().describe('Filtrar por tipo de entidade'),
    entityId: z.string().optional().describe('Filtrar por ID da entidade'),
  })
  .strip();

export class ListTimeEntriesDto extends createZodDto(ListTimeEntriesSchema) {}
