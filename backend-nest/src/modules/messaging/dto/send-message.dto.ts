import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  MESSAGING_LIMITS,
  MESSAGING_MESSAGE_TYPES,
  type MessagingMessageType,
} from 'src/domain/messaging/messaging.const';

export const SendMessageSchema = z
  .object({
    connectionId: z.string().max(MESSAGING_LIMITS.id).optional(),
    phone: z.string().min(1).max(MESSAGING_LIMITS.phone),
    type: z.enum(MESSAGING_MESSAGE_TYPES).optional(),
    text: z.string().max(MESSAGING_LIMITS.text).optional(),
    mediaUrl: z.string().url().max(2_048).optional(),
    caption: z.string().max(MESSAGING_LIMITS.caption).optional(),
    fileName: z.string().max(MESSAGING_LIMITS.fileName).optional(),
    templateId: z.string().max(MESSAGING_LIMITS.id).optional(),
    values: z
      .record(z.string().max(MESSAGING_LIMITS.templateValue))
      .refine(
        (values) =>
          Object.keys(values).length <= MESSAGING_LIMITS.templateValues,
        { message: `no máximo ${MESSAGING_LIMITS.templateValues} variáveis` },
      )
      .optional(),
  })
  .superRefine((value, ctx) => {
    // Mídia fica de fora de propósito: a origem (`mediaUrl` ou arquivo anexado) é conferida no envio.
    // Sem `type` e com arquivo, o tipo sai do mimetype — por isso o default TEXT só vale sem anexo.
    const type = value.type;
    const required: Partial<Record<string, string[]>> = {
      TEXT: ['text'],
      TEMPLATE: ['templateId'],
    };
    for (const field of (type && required[type]) || []) {
      if (!value[field as keyof typeof value]) {
        ctx.addIssue({
          code: 'custom',
          path: [field],
          message: `${field} é obrigatório para ${type}`,
        });
      }
    }
  });

export class SendMessageDto extends createZodDto(SendMessageSchema) {
  @ApiPropertyOptional({
    description: 'Conexão que envia. Omitido = a conexão padrão.',
  })
  connectionId?: string;

  @ApiProperty({ example: '5511987654321' })
  phone: string;

  @ApiPropertyOptional({ enum: MESSAGING_MESSAGE_TYPES })
  type?: MessagingMessageType;

  @ApiPropertyOptional({ example: 'Olá!' })
  text?: string;

  @ApiPropertyOptional()
  mediaUrl?: string;

  @ApiPropertyOptional()
  caption?: string;

  @ApiPropertyOptional()
  fileName?: string;

  @ApiPropertyOptional({
    description: 'Id do template do catálogo (ver /messaging/templates)',
  })
  templateId?: string;

  @ApiPropertyOptional({
    type: Object,
    description:
      'Valor por nome de variável; quem é opcional usa o default se omitido',
  })
  values?: Record<string, string>;
}
