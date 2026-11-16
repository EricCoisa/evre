import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { MESSAGING_LIMITS } from 'src/domain/messaging/messaging.const';

export const CreateLeadSchema = z
  .object({
    name: z.string().min(1).describe('Nome do lead'),
    phone: z
      .string()
      .min(1)
      .max(MESSAGING_LIMITS.phone)
      .optional()
      .describe('Telefone (pelo menos phone ou email)'),
    email: z
      .string()
      .email()
      .optional()
      .describe('E-mail (pelo menos phone ou email)'),
    message: z.string().min(1).describe('Mensagem / intenção'),
  })
  .strict()
  .refine((d) => d.phone || d.email, {
    message: 'Informe pelo menos phone ou email',
    path: ['phone'],
  });

export class CreateLeadDto extends createZodDto(CreateLeadSchema) {}
