import { ApiProperty } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const SendEmailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  html: z.string().min(1),
});

export class SendEmailDto extends createZodDto(SendEmailSchema) {
  @ApiProperty({ example: 'contato@exemplo.com' })
  to: string;

  @ApiProperty({ example: 'Obrigado pelo contato' })
  subject: string;

  @ApiProperty({ description: 'HTML do corpo do e-mail' })
  html: string;
}
