import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UpdateMessagingContactSchema = z
  .object({
    name: z.string().trim().min(1).max(120).nullable().optional(),
    optOut: z.boolean().optional(),
  })
  .refine((value) => value.name !== undefined || value.optOut !== undefined);

export class UpdateMessagingContactDto extends createZodDto(
  UpdateMessagingContactSchema,
) {}
