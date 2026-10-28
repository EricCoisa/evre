import { z } from 'zod';
import { PaginationQuerySchema } from 'src/common/schemas/pagination.schema';

export const ListMessagesQuerySchema = PaginationQuerySchema.extend({
  connectionId: z.string().optional(),
  phone: z.string().optional(),
  direction: z.enum(['INBOUND', 'OUTBOUND']).optional(),
});
export type ListMessagesQuery = z.infer<typeof ListMessagesQuerySchema>;

export const ListContactsQuerySchema = PaginationQuerySchema.extend({
  connectionId: z.string().optional(),
  search: z.string().trim().optional(),
});
export type ListContactsQuery = z.infer<typeof ListContactsQuerySchema>;

export const ListConversationsQuerySchema = z.object({
  phone: z.string().min(1),
});
export type ListConversationsQuery = z.infer<
  typeof ListConversationsQuerySchema
>;
