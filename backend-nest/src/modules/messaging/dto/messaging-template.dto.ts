import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { extractPlaceholders } from '../providers/template.util';

export const MESSAGING_TEMPLATE_CATEGORIES = [
  'AUTHENTICATION',
  'UTILITY',
  'MARKETING',
] as const;
export type MessagingTemplateCategoryInput =
  (typeof MESSAGING_TEMPLATE_CATEGORIES)[number];

/** Teto de botões por template — mesmo motivo do `.max()` em variáveis: JSON sem teto é DoS. */
export const MAX_TEMPLATE_BUTTONS = 10;

export const TemplateHeaderSchema = z
  .object({
    kind: z.literal('TEXT'),
    text: z.string().min(1).max(60),
  })
  .refine((value) => extractPlaceholders(value.text).length <= 1, {
    message: 'header TEXT aceita no máximo 1 variável',
    path: ['text'],
  });

const BASIC_URL_RE = /^https?:\/\/.+/;

/** Liga o botão a um espaço do tipo de template; ausente significa botão livre. */
const slotField = z
  .string()
  .regex(/^[a-z][a-z0-9_]*$/, 'slot deve ser snake_case')
  .max(40)
  .optional();

/** Exatamente uma variável, e só no fim — senão a reprovação na Meta não explica o motivo. */
function endsWithSingleVariable(url: string): boolean {
  const vars = extractPlaceholders(url);
  if (vars.length === 0) return true;
  if (vars.length > 1) return false;
  return url.trimEnd().endsWith('}}');
}

const UrlButtonSchema = z.object({
  kind: z.literal('URL'),
  label: z.string().min(1).max(25),
  url: z
    .string()
    .min(1)
    .max(2000)
    .regex(BASIC_URL_RE, 'url deve ser http(s) absoluta'),
  slot: slotField,
});

const QuickReplyButtonSchema = z.object({
  kind: z.literal('QUICK_REPLY'),
  label: z.string().min(1).max(25),
  payload: z.string().max(128).optional(),
  slot: slotField,
});

const PhoneNumberButtonSchema = z.object({
  kind: z.literal('PHONE_NUMBER'),
  label: z.string().min(1).max(25),
  phoneNumber: z.string().min(1).max(20),
  slot: slotField,
});

const CopyCodeButtonSchema = z.object({
  kind: z.literal('COPY_CODE'),
  label: z.string().min(1).max(25),
  payload: z.string().max(128).optional(),
  slot: slotField,
});

/** `.refine()` não pode entrar no discriminatedUnion (exige ZodObject puro) — a restrição de URL vai por fora. */
export const TemplateButtonSchema = z
  .discriminatedUnion('kind', [
    UrlButtonSchema,
    QuickReplyButtonSchema,
    PhoneNumberButtonSchema,
    CopyCodeButtonSchema,
  ])
  .refine(
    (value) => value.kind !== 'URL' || endsWithSingleVariable(value.url),
    { message: 'url aceita no máximo 1 variável, e só no fim', path: ['url'] },
  );

/** Máximo por tipo de botão numa mesma mensagem (limites da Meta; os de resposta rápida só têm o teto total). */
export const MAX_TEMPLATE_BUTTONS_BY_KIND = {
  URL: 2,
  PHONE_NUMBER: 1,
  COPY_CODE: 1,
} as const;

export const TemplateButtonsSchema = z
  .array(TemplateButtonSchema)
  .max(MAX_TEMPLATE_BUTTONS)
  .superRefine((buttons, ctx) => {
    for (const [kind, max] of Object.entries(MAX_TEMPLATE_BUTTONS_BY_KIND)) {
      if (buttons.filter((b) => b.kind === kind).length > max) {
        ctx.addIssue({
          code: 'custom',
          message: `no máximo ${max} botão(ões) do tipo ${kind}`,
        });
      }
    }
  });

export type TemplateHeaderInput = z.infer<typeof TemplateHeaderSchema>;
export type TemplateButtonInput = z.infer<typeof TemplateButtonSchema>;

/** Vira o nome no catálogo do provider (minúsculo): letras, números e `_`, começando por letra. */
const TEMPLATE_KEY_RE = /^[A-Za-z][A-Za-z0-9_]*$/;
/** BCP 47 simples (`pt`, `pt-BR`, `en-US`): o formato, não a lista que cada provider aceita. */
const LANGUAGE_RE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

export const CreateMessagingTemplateSchema = z.object({
  typeId: z.string().min(1),
  key: z
    .string()
    .min(1)
    .max(100)
    .regex(
      TEMPLATE_KEY_RE,
      'chave deve começar por letra e ter só letras, números e _',
    ),
  language: z
    .string()
    .min(2)
    .max(10)
    .regex(LANGUAGE_RE, 'idioma deve estar no formato pt, pt-BR ou en-US'),
  category: z.enum(MESSAGING_TEMPLATE_CATEGORIES),
  header: TemplateHeaderSchema.optional(),
  body: z.string().min(1).max(1024),
  footer: z.string().max(60).optional(),
  buttons: TemplateButtonsSchema.optional(),
  bypassOptOut: z.boolean().optional(),
});

export const UpdateMessagingTemplateSchema = z.object({
  category: z.enum(MESSAGING_TEMPLATE_CATEGORIES).optional(),
  header: TemplateHeaderSchema.nullable().optional(),
  body: z.string().min(1).max(1024).optional(),
  footer: z.string().max(60).nullable().optional(),
  buttons: TemplateButtonsSchema.nullable().optional(),
  bypassOptOut: z.boolean().optional(),
  acknowledgeCategoryChange: z.boolean().optional(),
});

export class CreateMessagingTemplateDto extends createZodDto(
  CreateMessagingTemplateSchema,
) {
  @ApiProperty() typeId: string;
  @ApiProperty({ example: 'PASSWORD_CHANGED' }) key: string;
  @ApiProperty({ example: 'pt-BR' }) language: string;
  @ApiProperty({ enum: MESSAGING_TEMPLATE_CATEGORIES })
  category: MessagingTemplateCategoryInput;
  @ApiPropertyOptional({ type: Object }) header?: TemplateHeaderInput;
  @ApiProperty({ example: 'Olá {{ first_name }}, sua senha foi alterada.' })
  body: string;
  @ApiPropertyOptional() footer?: string;
  @ApiPropertyOptional({ type: [Object] })
  buttons?: TemplateButtonInput[];
  @ApiPropertyOptional({ default: false }) bypassOptOut?: boolean;
}

export class UpdateMessagingTemplateDto extends createZodDto(
  UpdateMessagingTemplateSchema,
) {
  @ApiPropertyOptional({ enum: MESSAGING_TEMPLATE_CATEGORIES })
  category?: MessagingTemplateCategoryInput;
  @ApiPropertyOptional({ type: Object, nullable: true })
  header?: TemplateHeaderInput | null;
  @ApiPropertyOptional() body?: string;
  @ApiPropertyOptional({ type: String, nullable: true }) footer?: string | null;
  @ApiPropertyOptional({ type: [Object], nullable: true })
  buttons?: TemplateButtonInput[] | null;
  @ApiPropertyOptional() bypassOptOut?: boolean;
  @ApiPropertyOptional({
    description:
      'Dá ciente do alerta de categoria alterada pela Meta (limpa previousCategory)',
  })
  acknowledgeCategoryChange?: boolean;
}

/** Resumo da submissão de um template numa conexão — o que a lista mostra de status e motivo. */
export class MessagingTemplateSubmissionSummaryDto {
  @ApiProperty() connectionId: string;
  @ApiProperty({
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'PAUSED', 'DISABLED'],
  })
  status: string;
  @ApiPropertyOptional({ type: String, nullable: true }) reason: string | null;
  @ApiProperty({ type: String, format: 'date-time' }) submittedAt: Date;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  reviewedAt: Date | null;
  @ApiProperty({
    description:
      'O texto local mudou depois do último envio: na Meta segue a versão anterior',
  })
  outOfSync: boolean;
}

export class MessagingTemplateDto {
  @ApiProperty() id: string;
  @ApiProperty() key: string;
  @ApiProperty() language: string;
  @ApiProperty({ enum: MESSAGING_TEMPLATE_CATEGORIES })
  category: MessagingTemplateCategoryInput;
  @ApiProperty() typeId: string;
  @ApiPropertyOptional({ type: Object, nullable: true })
  header: TemplateHeaderInput | null;
  @ApiProperty() body: string;
  @ApiPropertyOptional({ type: String, nullable: true }) footer: string | null;
  @ApiPropertyOptional({ type: [Object], nullable: true })
  buttons: TemplateButtonInput[] | null;
  @ApiProperty() bypassOptOut: boolean;
  @ApiProperty() isSystem: boolean;
  @ApiPropertyOptional({
    enum: MESSAGING_TEMPLATE_CATEGORIES,
    nullable: true,
    description:
      'Categoria antes de a Meta reclassificar o template; presente até o operador dar ciente',
  })
  previousCategory?: MessagingTemplateCategoryInput | null;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  categoryChangedAt?: Date | null;
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      'Preenchido quando o tipo mudou e o template deixou de cumpri-lo: não envia até ser ajustado',
  })
  invalidReason?: string | null;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  invalidatedAt?: Date | null;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt: Date;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt: Date;
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      'Status da submissão para a conexão pedida (?connectionId=); ausente sem esse filtro',
  })
  approvalStatus?: string | null;
  @ApiPropertyOptional({
    type: [MessagingTemplateSubmissionSummaryDto],
    description: 'Submissões por conexão; presente na listagem',
  })
  submissions?: MessagingTemplateSubmissionSummaryDto[];
}
