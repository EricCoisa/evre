import { ApiProperty } from '@nestjs/swagger';

export class NotificationDto {
  @ApiProperty({
    description:
      'ID do destinatário (NotificationRecipient) — é o que /me/:id/read e /me/:id/dismiss esperam',
  })
  id: string;

  @ApiProperty({
    description: 'Chave do tipo (ver notification-type.const.ts)',
  })
  type: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Título já resolvido no idioma do request',
  })
  title: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Mensagem já resolvida no idioma do request',
  })
  message: string | null;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    description: 'Dados brutos para o componente customizado no frontend',
  })
  payload: Record<string, unknown> | null;

  @ApiProperty({
    type: String,
    nullable: true,
    required: false,
    description: 'Link opcional associado à notificação',
  })
  actionUrl: string | null;

  @ApiProperty({
    type: Date,
    nullable: true,
    description: 'Quando o destinatário leu, null se ainda não lida',
  })
  readAt: Date | null;

  @ApiProperty({
    type: Date,
    nullable: true,
    description: 'Quando o destinatário dispensou, null se ainda visível',
  })
  dismissedAt: Date | null;

  @ApiProperty({ type: Date, description: 'Quando o evento foi criado' })
  createdAt: Date;
}
