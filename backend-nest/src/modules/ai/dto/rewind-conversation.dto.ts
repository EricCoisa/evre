import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const RewindConversationSchema = z.object({
  /** Mensagem a partir da qual a conversa é descartada (ela inclusive). */
  messageId: z.string(),
});

export class RewindConversationDto extends createZodDto(
  RewindConversationSchema,
) {}
