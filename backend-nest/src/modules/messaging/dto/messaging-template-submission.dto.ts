import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const SubmitTemplateSchema = z.object({
  connectionId: z.string().min(1),
  examples: z.record(z.string()).default({}),
  headerImageUrl: z.string().url().optional(),
});

export class SubmitTemplateDto extends createZodDto(SubmitTemplateSchema) {
  @ApiProperty({
    description: 'Conexão (WABA) onde o template será criado ou editado',
  })
  connectionId: string;

  @ApiProperty({
    type: Object,
    description:
      'Valor de exemplo por variável, exigido pela Meta para revisar o template (inclusive as obrigatórias)',
  })
  examples: Record<string, string>;

  @ApiPropertyOptional({
    description:
      'URL pública da imagem de cabeçalho (IMAGE). Sobrescreve a URL armazenada no template apenas para esta submissão.',
  })
  headerImageUrl?: string;
}

export class MessagingTemplateSubmissionDto {
  @ApiProperty() id: string;
  @ApiProperty() templateId: string;
  @ApiProperty() connectionId: string;
  @ApiPropertyOptional({ type: String, nullable: true }) providerTemplateId:
    string | null;
  @ApiProperty({
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'PAUSED', 'DISABLED'],
  })
  status: string;
  @ApiPropertyOptional({ type: String, nullable: true }) reason: string | null;
  @ApiProperty({ type: String, format: 'date-time' }) submittedAt: Date;
  @ApiPropertyOptional({ nullable: true, type: String, format: 'date-time' })
  reviewedAt: Date | null;
}

/** Problema que a Meta costuma apontar no template; `code` estável para a tela traduzir. */
export class MetaTemplateIssueDto {
  @ApiProperty({ example: 'BODY_ENDS_WITH_VARIABLE' }) code: string;
  @ApiProperty({
    enum: ['error', 'warning'],
    description: 'error = a submissão é barrada; warning = só avisa',
  })
  severity: 'error' | 'warning';
  @ApiProperty({ enum: ['body', 'header', 'footer', 'buttons', 'template'] })
  field: 'body' | 'header' | 'footer' | 'buttons' | 'template';
  @ApiProperty() message: string;
  @ApiPropertyOptional({ type: Object }) params?: Record<
    string,
    string | number
  >;
}

export class MetaTemplateCheckDto {
  @ApiProperty({ type: [MetaTemplateIssueDto] }) issues: MetaTemplateIssueDto[];
}

export const CheckMetaTemplateSchema = z.object({
  category: z.enum(['AUTHENTICATION', 'UTILITY', 'MARKETING']),
  body: z.string().max(4096).default(''),
  header: z
    .discriminatedUnion('kind', [
      z.object({ kind: z.literal('TEXT'), text: z.string().max(200) }),
      z.object({ kind: z.literal('IMAGE'), url: z.string().url() }),
    ])
    .nullish(),
  footer: z.string().max(200).nullish(),
  buttons: z.array(z.any()).max(20).nullish(),
});

export class CheckMetaTemplateDto extends createZodDto(
  CheckMetaTemplateSchema,
) {
  @ApiProperty({ enum: ['AUTHENTICATION', 'UTILITY', 'MARKETING'] })
  category: 'AUTHENTICATION' | 'UTILITY' | 'MARKETING';
  @ApiProperty() body: string;
  @ApiPropertyOptional({ type: Object, nullable: true }) header?:
    | { kind: 'TEXT'; text: string }
    | { kind: 'IMAGE'; url: string }
    | null;
  @ApiPropertyOptional({ type: String, nullable: true }) footer?: string | null;
  @ApiPropertyOptional({ type: [Object], nullable: true }) buttons?:
    unknown[] | null;
}
