import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { MessagingMessage } from '@prisma/client';
import { renderResolvedParts } from '../providers/template.util';

/** Header de template — apenas TEXT por enquanto. */
export interface TemplateHeaderDto {
  kind: 'TEXT';
  text: string;
}

/** Botão de template — tipos suportados. */
export type TemplateButtonDto =
  | { kind: 'URL'; label: string; url: string }
  | { kind: 'QUICK_REPLY'; label: string; payload?: string }
  | { kind: 'PHONE_NUMBER'; label: string; phoneNumber: string }
  | { kind: 'COPY_CODE'; label: string; payload?: string };

/** Dados do template já resolvido e renderizado. */
export interface MessageTemplateDataDto {
  name: string;
  language: string;
  category: 'AUTHENTICATION' | 'UTILITY' | 'MARKETING';
  body: string;
  header?: TemplateHeaderDto;
  footer?: string;
  buttons?: TemplateButtonDto[];
  values?: Record<string, string>;
}

/** Mensagem como a API a expõe: sem `raw` (payload cru do provider) nem ids internos. */
export class MessagingMessageDto {
  @ApiProperty() id: string;
  @ApiProperty({ description: 'Conexão (número) pela qual a mensagem passou' })
  connectionId: string;
  @ApiProperty({ enum: ['INBOUND', 'OUTBOUND'] }) direction: string;
  @ApiProperty({ enum: ['QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED'] })
  status: string;
  @ApiProperty({ example: '5511987654321' }) phone: string;
  @ApiProperty({
    description:
      'TEXT, IMAGE, VIDEO, DOCUMENT, AUDIO, TEMPLATE, STICKER ou UNSUPPORTED',
  })
  type: string;
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Texto ou legenda',
  })
  text: string | null;
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      'Só em envio por link. Para qualquer outra mídia use GET /messaging/messages/{id}/media',
  })
  mediaUrl: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) mimeType:
    string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) fileName:
    string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) error: string | null;
  @ApiPropertyOptional({
    type: 'object',
    nullable: true,
    description: 'Dados do template quando type=TEMPLATE',
    additionalProperties: true,
  })
  templateData?: MessageTemplateDataDto;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt: Date;
}

/** Type union para type-safety: garante que templateData está presente APENAS em TEMPLATE messages. */
export type MessagingMessageDtoTyped =
  | (Omit<MessagingMessageDto, 'templateData'> & {
      type: Exclude<MessagingMessageDto['type'], 'TEMPLATE'>;
      templateData?: undefined;
    })
  | (MessagingMessageDto & {
      type: 'TEMPLATE';
      templateData: MessageTemplateDataDto;
    });

function extractTemplateData(raw: unknown): MessageTemplateDataDto | undefined {
  if (!raw || typeof raw !== 'object') return undefined;

  const rawObj = raw as Record<string, unknown>;
  if (!rawObj.template || typeof rawObj.template !== 'object') return undefined;

  const template = rawObj.template as Record<string, unknown>;
  const values = template.values as Record<string, string> | undefined;

  const name = typeof template.name === 'string' ? template.name : '';
  const language =
    typeof template.language === 'string' ? template.language : '';
  const body = typeof template.body === 'string' ? template.body : '';
  const footer =
    typeof template.footer === 'string' ? template.footer : undefined;

  // A linha guarda header/footer/URL com `{{ }}` (a Meta os substitui); a tela mostra o texto final.
  const parts = renderResolvedParts({
    values,
    header: template.header as TemplateHeaderDto | undefined,
    footer,
    buttons: template.buttons as TemplateButtonDto[] | undefined,
  });
  return {
    name,
    language,
    category:
      (template.category as MessageTemplateDataDto['category']) || 'UTILITY',
    body,
    header: parts.header,
    footer: parts.footer,
    buttons: parts.buttons,
    values,
  };
}

export function toMessagingMessageDto(
  row: MessagingMessage & { contact: { phone: string } },
): MessagingMessageDtoTyped {
  const base: MessagingMessageDto = {
    id: row.id,
    connectionId: row.connectionId,
    direction: row.direction,
    status: row.status,
    phone: row.contact.phone,
    text: row.text,
    mediaUrl: row.mediaUrl,
    mimeType: row.mimeType,
    fileName: row.fileName,
    error: row.error,
    createdAt: row.createdAt,
    type: row.type,
  };

  if (row.type === 'TEMPLATE') {
    const templateData = extractTemplateData(row.raw);
    return {
      ...base,
      type: 'TEMPLATE',
      templateData: templateData || {
        name: '',
        language: '',
        category: 'UTILITY',
        body: '',
      },
    };
  }

  return base as MessagingMessageDtoTyped;
}
