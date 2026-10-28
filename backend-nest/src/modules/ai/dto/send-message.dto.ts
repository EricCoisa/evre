import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** Tela aberta no front no momento do envio (path + query, ex: `/users?tab=roles`). */
export const PageContextSchema = z
  .string()
  .max(200)
  .regex(/^\/[^\n\r]*$/)
  .optional();

/** O que está montado na tela (ver `ScreenItem`); contexto para o prompt, nunca usado para autorização. */
const ScreenItemSchema = z.object({
  kind: z.enum(['collection', 'config', 'record']),
  source: z.string().regex(/^[\w-]{1,60}$/),
  detail: z
    .string()
    .regex(/^[\w.-]{1,120}$/)
    .optional(),
});

export const ScreenContextSchema = z.array(ScreenItemSchema).max(40).optional();

const SendMessageSchema = z.object({
  content: z.string().min(1).max(8000),
  model: z.string().optional(),
  page: PageContextSchema,
  screen: ScreenContextSchema,
});

export class SendAiMessageDto extends createZodDto(SendMessageSchema) {}
