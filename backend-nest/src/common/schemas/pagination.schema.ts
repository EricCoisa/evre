import { z } from 'zod';

export const PaginationQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .default('1')
    .transform((v) => Number(v))
    .catch(1)
    .pipe(z.number().int().min(1)),

  limit: z
    .string()
    .optional()
    .default('10')
    .transform((v) => Number(v))
    .catch(10)
    .pipe(z.number().int().min(1).max(100)),

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
    .transform((v): Record<string, string> => {
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
