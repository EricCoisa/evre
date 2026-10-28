import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { MESSAGING_LIMITS } from 'src/domain/messaging/messaging.const';

export const MESSAGING_PRESENCE_STATES = [
  'COMPOSING',
  'RECORDING',
  'PAUSED',
] as const;

export const SendPresenceSchema = z.object({
  connectionId: z.string().max(MESSAGING_LIMITS.id).optional(),
  phone: z.string().min(1).max(MESSAGING_LIMITS.phone),
  state: z.enum(MESSAGING_PRESENCE_STATES),
});

export class SendPresenceDto extends createZodDto(SendPresenceSchema) {
  @ApiPropertyOptional({
    description: 'Conexão que envia. Omitido = a conexão padrão.',
  })
  connectionId?: string;

  @ApiProperty({ example: '5511987654321' })
  phone: string;

  @ApiProperty({ enum: MESSAGING_PRESENCE_STATES })
  state: (typeof MESSAGING_PRESENCE_STATES)[number];
}
