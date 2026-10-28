import { ApiProperty } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { EmailProviderConst } from 'src/domain/mail/mail.const';

/** Schema de validação do formulário de configuração de email. */
export const SaveEmailConfigSchema = z
  .object({
    provider: z.enum([EmailProviderConst.RESEND, EmailProviderConst.SMTP]),
    defaultFrom: z.string().min(1).email(),
    // Segredos: vazio = manter o valor já gravado (o GET devolve `****`).
    apiKey: z.string().optional(),
    smtpHost: z.string().optional(),
    smtpPort: z.coerce.number().int().min(1).max(65535).optional(),
    smtpUser: z.string().optional(),
    smtpPass: z.string().optional(),
    smtpSecure: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.provider !== EmailProviderConst.SMTP) return;
    if (!data.smtpHost?.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['smtpHost'],
        message: 'smtpHost é obrigatório para SMTP',
      });
    }
    if (data.smtpPort === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['smtpPort'],
        message: 'smtpPort é obrigatório para SMTP',
      });
    }
  });

export class SaveEmailConfigDto extends createZodDto(SaveEmailConfigSchema) {
  @ApiProperty({ enum: ['RESEND', 'SMTP'], example: 'SMTP' })
  provider: string;

  @ApiProperty({ example: 'no-reply@example.com' })
  defaultFrom: string;

  @ApiProperty({
    required: false,
    description: 'API key do Resend. Vazio mantém a credencial já gravada',
  })
  apiKey?: string;

  @ApiProperty({ required: false, example: 'smtp.example.com' })
  smtpHost?: string;

  @ApiProperty({ required: false, example: 587 })
  smtpPort?: number;

  @ApiProperty({ required: false, example: 'user@example.com' })
  smtpUser?: string;

  @ApiProperty({
    required: false,
    description: 'Senha SMTP. Vazio mantém a credencial já gravada',
  })
  smtpPass?: string;

  @ApiProperty({ required: false, example: false })
  smtpSecure?: boolean;
}
