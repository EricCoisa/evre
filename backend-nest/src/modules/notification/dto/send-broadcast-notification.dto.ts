import { ApiProperty } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const SendBroadcastNotificationSchema = z
  .object({
    title: z.string().min(1).max(200),
    message: z.string().min(1).max(2000),
    actionUrl: z.string().min(1).max(2000).optional(),
    all: z.boolean().optional().default(false),
    roleNames: z.array(z.string().min(1)).optional().default([]),
  })
  .refine((v) => v.all || v.roleNames.length > 0, {
    message: 'Informe "all" ou ao menos uma role em "roleNames"',
    path: ['roleNames'],
  });

/** Composer admin — ver docs/backend/notifications.md ("Gaps explícitos"). */
export class SendBroadcastNotificationDto extends createZodDto(
  SendBroadcastNotificationSchema,
) {
  @ApiProperty({
    example: 'Manutenção programada',
    description: 'Título da notificação',
  })
  title: string;

  @ApiProperty({
    example: 'O sistema ficará indisponível das 02h às 04h de domingo.',
    description: 'Mensagem da notificação',
  })
  message: string;

  @ApiProperty({
    example: '/settings',
    required: false,
    description: 'Link opcional associado à notificação',
  })
  actionUrl?: string;

  @ApiProperty({
    default: false,
    description:
      'Envia para todos os usuários ativos — ignora roleNames quando true',
  })
  all: boolean;

  @ApiProperty({
    example: ['ADMIN'],
    isArray: true,
    description: 'Roles-alvo (Role.name) quando "all" é falso',
  })
  roleNames: string[];
}
