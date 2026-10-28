import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const CreateConversationSchema = z.object({
  title: z.string().optional(),
});

export class CreateConversationDto extends createZodDto(
  CreateConversationSchema,
) {}
