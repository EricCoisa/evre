import { z } from 'zod';
import { PaginationQuerySchema } from 'src/common/schemas/pagination.schema';

export const ListMyNotificationsQuerySchema = PaginationQuerySchema.extend({
  unreadOnly: z
    .union([z.string(), z.boolean()])
    .optional()
    .transform((v) => (typeof v === 'boolean' ? v : v === 'true')),
});

export type ListMyNotificationsQuery = z.infer<
  typeof ListMyNotificationsQuerySchema
>;
