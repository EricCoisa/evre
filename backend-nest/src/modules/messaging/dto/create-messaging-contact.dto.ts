import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { MESSAGING_LIMITS } from 'src/domain/messaging/messaging.const';

export const CreateMessagingContactSchema = z.object({
  phone: z.string().min(1).max(MESSAGING_LIMITS.phone),
  name: z.string().trim().min(1).max(120).nullable().optional(),
});

export class CreateMessagingContactDto extends createZodDto(
  CreateMessagingContactSchema,
) {}
