import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { PageContextSchema, ScreenContextSchema } from './send-message.dto';

const ResolveApprovalSchema = z.object({
  toolCallId: z.string(),
  decision: z.enum(['once', 'conversation', 'deny']),
  page: PageContextSchema,
  screen: ScreenContextSchema,
});

export class ResolveApprovalDto extends createZodDto(ResolveApprovalSchema) {}
