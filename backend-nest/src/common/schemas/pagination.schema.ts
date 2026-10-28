import { z } from 'zod';
import type { PageSourceParam } from 'src/domain/page-builder/page-source.types';

/** Descrição, para o agente do PageBuilder, dos params que endpoints paginados aceitam. */
export const PAGINATION_PAGE_SOURCE_PARAMS: PageSourceParam[] = [
  {
    name: 'page',
    type: 'number',
    description:
      'Página a exibir, inteiro >= 1. Um bloco mostra UMA página por vez.',
  },
  {
    name: 'limit',
    type: 'number',
    description: 'Quantidade de linhas, inteiro de 1 a 50.',
  },
  { name: 'search', type: 'string', description: 'Texto livre de busca.' },
];

export const PaginationQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => {
      const n = v ? Number(v) : NaN;
      return Number.isInteger(n) && n >= 1 ? n : 1;
    }),

  limit: z
    .string()
    .optional()
    .transform((v) => {
      const n = v ? Number(v) : NaN;
      return Number.isInteger(n) ? Math.min(Math.max(n, 1), 50) : 10;
    }),

  pagination: z
    .union([z.string(), z.boolean()])
    .optional()
    .default('true')
    .transform((v) => {
      if (typeof v === 'boolean') return v;
      const s = String(v).trim().toLowerCase();
      if (['1', 'true', 'on', 'yes'].includes(s)) return true;
      if (['0', 'false', 'off', 'no'].includes(s)) return false;
      return true;
    })
    .catch(true),

  search: z.string().trim().optional(),
  filter: z
    .union([z.string(), z.record(z.string(), z.string())])
    .optional()
    .transform((v): Record<string, string> | undefined => {
      if (v === undefined) return undefined;
      if (typeof v === 'string') {
        try {
          const parsed = JSON.parse(v) as unknown;
          if (typeof parsed === 'object' && parsed !== null) {
            return parsed as Record<string, string>;
          }
          return {};
        } catch {
          return {};
        }
      }
      return v || {};
    }),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
