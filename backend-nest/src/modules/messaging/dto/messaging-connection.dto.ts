import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  MessagingProviderConst,
  type MessagingProvider,
} from 'src/domain/messaging/messaging.const';
import type { ConnectionView } from '../messaging-connection.service';

const PROVIDERS = Object.values(MessagingProviderConst) as [
  MessagingProvider,
  ...MessagingProvider[],
];

/** Corpo de criar/editar conexão: campos são a união dos três providers, o adapter descarta o resto. */
export const SaveMessagingConnectionSchema = z.object({
  /** Só na criação. Editar não troca o provider da conexão. */
  provider: z.enum(PROVIDERS).optional(),
  baseUrl: z.string().optional(),
  token: z.string().optional(),
  instance: z.string().optional(),
  webhookSecret: z.string().optional(),
  phoneNumberId: z.string().optional(),
  accessToken: z.string().optional(),
  appSecret: z.string().optional(),
  verifyToken: z.string().optional(),
  graphVersion: z.string().optional(),
  appId: z.string().optional(),
  wabaId: z.string().optional(),
  webhookPublicUrl: z.string().optional(),
});

const SECRET = {
  required: false,
  description: 'Vazio mantém a credencial já gravada',
};

export class SaveMessagingConnectionDto extends createZodDto(
  SaveMessagingConnectionSchema,
) {
  @ApiPropertyOptional({
    enum: PROVIDERS,
    description:
      'Obrigatório ao criar. Ao editar, se enviado, tem de ser o da conexão.',
  })
  provider?: MessagingProvider;

  @ApiPropertyOptional({ example: 'http://evolution:8080' })
  baseUrl?: string;

  @ApiProperty(SECRET)
  token?: string;

  @ApiPropertyOptional({
    deprecated: true,
    description:
      'Ignorado: o nome/id da instância é gerado pelo sistema ao criar a conexão (Evolution API e Go).',
  })
  instance?: string;

  @ApiProperty(SECRET)
  webhookSecret?: string;

  @ApiPropertyOptional({ example: '123456789' })
  phoneNumberId?: string;

  @ApiProperty(SECRET)
  accessToken?: string;

  @ApiProperty(SECRET)
  appSecret?: string;

  @ApiProperty(SECRET)
  verifyToken?: string;

  @ApiPropertyOptional({ example: 'v21.0' })
  graphVersion?: string;

  @ApiPropertyOptional()
  appId?: string;

  @ApiPropertyOptional()
  wabaId?: string;

  @ApiPropertyOptional({
    description:
      'Override da URL pública do webhook (vale para o sistema todo); use em dev com túnel',
  })
  webhookPublicUrl?: string;
}

/** Conexão como a API a expõe: sem segredo — só se cada um está preenchido. */
export class MessagingConnectionDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: PROVIDERS }) provider: MessagingProvider;
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '5534998956461',
    description:
      'Número da conta. Nulo até o primeiro pareamento; depois é fixo — reconectar exige o mesmo número.',
  })
  phone: string | null;
  @ApiProperty({
    description:
      'Conexão padrão: usada para enviar quando ninguém informa qual. Só uma é padrão.',
  })
  isDefault: boolean;
  @ApiProperty({
    description:
      'Arquivada: fora de uso e sem número, mantida para o histórico continuar legível.',
  })
  archived: boolean;
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    description: 'Campos de configuração que não são segredo',
  })
  config: Record<string, string>;
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'boolean' },
    description:
      'Para cada campo secreto, se já está preenchido (o valor nunca sai)',
  })
  secrets: Record<string, boolean>;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt: Date;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt: Date;
}

export class WebhookRegistrationDto {
  @ApiProperty() registered: boolean;
  @ApiProperty({
    description:
      'URL que o provider deve chamar (use para registrar à mão se falhou)',
  })
  url: string;
  @ApiProperty({ description: 'Detalhe do registro, ou o motivo da falha' })
  message: string;
}

export class SaveMessagingConnectionResponseDto {
  @ApiProperty({ type: MessagingConnectionDto })
  connection: MessagingConnectionDto;
  @ApiProperty({ type: WebhookRegistrationDto })
  webhook: WebhookRegistrationDto;
}

export const toMessagingConnectionDto = (
  view: ConnectionView,
): MessagingConnectionDto => view;
