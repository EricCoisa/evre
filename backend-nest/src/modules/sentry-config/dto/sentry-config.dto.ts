import { createZodDto } from 'nestjs-zod';
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

/** Schema do formulário de configuração do Sentry; dsn vazio desliga o Sentry. */
export const SaveSentryConfigSchema = z.object({
  dsn: z.string().optional(),
});

export class SaveSentryConfigDto extends createZodDto(SaveSentryConfigSchema) {
  @ApiProperty({
    required: false,
    example: 'https://abc123@o0.ingest.sentry.io/1234567',
    description: 'Vazio desliga o Sentry',
  })
  dsn?: string;
}
