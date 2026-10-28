import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { MessagingContact, MessagingConversation } from '@prisma/client';
import {
  MESSAGING_MESSAGE_TYPES,
  MessagingProviderConst,
  type MessagingMessageType,
  type MessagingProvider,
} from 'src/domain/messaging/messaging.const';

export class SendMessageResponseDto {
  @ApiProperty({ description: 'Id da mensagem registrada' }) id: string;
}

export class MessagingTypingCapabilitiesDto {
  @ApiProperty({
    description: 'O provider avisa quando o contato está digitando',
  })
  inbound: boolean;
  @ApiProperty({
    description: 'Conseguimos avisar o contato que o operador está digitando',
  })
  outbound: boolean;
}

export class MessagingTemplateComponentsCapabilitiesDto {
  @ApiProperty({ enum: ['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT'], isArray: true })
  header: string[];
  @ApiProperty() footer: boolean;
  @ApiProperty({
    enum: ['QUICK_REPLY', 'URL', 'PHONE_NUMBER', 'COPY_CODE'],
    isArray: true,
  })
  buttons: string[];
}

export class MessagingTemplateCapabilitiesDto {
  @ApiProperty({ description: 'O provider tem fluxo de aprovação (Meta)' })
  approval: boolean;
  @ApiProperty({
    description:
      'Categorias cujo corpo é escrito pelo provider (ex.: AUTHENTICATION na Meta)',
    isArray: true,
  })
  providerOwnedBody: string[];
  @ApiProperty({ type: MessagingTemplateComponentsCapabilitiesDto })
  components: MessagingTemplateComponentsCapabilitiesDto;
}

export class MessagingCapabilitiesDto {
  @ApiProperty({ enum: Object.values(MessagingProviderConst) })
  provider: MessagingProvider;
  @ApiProperty({ enum: MESSAGING_MESSAGE_TYPES, isArray: true })
  messageTypes: MessagingMessageType[];
  @ApiProperty({ type: MessagingTemplateCapabilitiesDto })
  template: MessagingTemplateCapabilitiesDto;
  @ApiProperty({
    description: 'O provider aceita o áudio gravado pelo navegador',
  })
  voiceRecording: boolean;
  @ApiProperty({ type: MessagingTypingCapabilitiesDto })
  typing: MessagingTypingCapabilitiesDto;
  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Janela de atendimento em horas desde a última mensagem recebida; fora dela só template. Nulo = sem janela',
  })
  serviceWindowHours: number | null;
}

/** Contato como a API o expõe: uma pessoa, identidade global — sem `metadata`, que é de uso interno. */
export class MessagingContactDto {
  @ApiProperty() id: string;
  @ApiProperty({ example: '5511987654321' }) phone: string;
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Nome definido pelo operador',
  })
  name: string | null;
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Nome que o contato definiu no WhatsApp',
  })
  pushName: string | null;
  @ApiProperty({
    description:
      'Há foto de perfil. A imagem vem de GET /messaging/contacts/{id}/photo — a URL do WhatsApp expira e não é exposta.',
  })
  hasProfilePicture: boolean;
  @ApiProperty() optOut: boolean;
  @ApiPropertyOptional({ nullable: true, type: String, format: 'date-time' })
  optOutAt: Date | null;
  @ApiProperty({ description: 'Quantas conversas (conexões) este contato tem' })
  conversationCount: number;
  @ApiPropertyOptional({
    nullable: true,
    type: String,
    format: 'date-time',
    description: 'Mensagem mais recente, de qualquer uma das conversas',
  })
  lastMessageAt: Date | null;
  @ApiProperty({
    description:
      'Conexão da conversa mais recente. Com conversationCount > 1, abrir por aqui é só um ' +
      'ponto de partida — o seletor de conversa decide a de verdade.',
  })
  lastConnectionId: string;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt: Date;
}

/** Uma thread do seletor de conversa: qual conexão (nosso número), e se ela está arquivada (histórico só-leitura). */
export class MessagingConversationSummaryDto {
  @ApiProperty() connectionId: string;
  @ApiProperty({ enum: Object.values(MessagingProviderConst) })
  provider: MessagingProvider;
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Nosso número nesta conexão; nulo se nunca pareou',
  })
  connectionPhone: string | null;
  @ApiProperty({
    description: 'Conexão arquivada: a thread segue legível, mas não envia',
  })
  archived: boolean;
  @ApiPropertyOptional({ nullable: true, type: String, format: 'date-time' })
  lastMessageAt: Date | null;
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    format: 'date-time',
    description:
      'Última mensagem RECEBIDA — base da janela de atendimento de 24h da Meta (ausente nos demais providers)',
  })
  lastInboundAt: Date | null;
}

export function toMessagingConversationSummaryDto(
  row: MessagingConversation & {
    connection: {
      provider: MessagingProvider;
      phone: string | null;
      archivedAt: Date | null;
    };
  },
): MessagingConversationSummaryDto {
  return {
    connectionId: row.connectionId,
    provider: row.connection.provider,
    connectionPhone: row.connection.phone,
    archived: row.connection.archivedAt !== null,
    lastMessageAt: row.lastMessageAt,
    lastInboundAt: row.lastInboundAt,
  };
}

export function toMessagingContactDto(
  row: MessagingContact,
  activity: {
    conversationCount: number;
    lastMessageAt: Date | null;
    lastConnectionId: string;
  },
): MessagingContactDto {
  return {
    id: row.id,
    phone: row.phone,
    name: row.name,
    pushName: row.pushName,
    hasProfilePicture: !!row.profilePictureUrl,
    optOut: row.optOut,
    optOutAt: row.optOutAt,
    conversationCount: activity.conversationCount,
    lastMessageAt: activity.lastMessageAt,
    lastConnectionId: activity.lastConnectionId,
    createdAt: row.createdAt,
  };
}
