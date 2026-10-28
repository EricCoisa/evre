import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { RESERVED_LIST } from 'src/domain/messaging/messaging-variables.const';
import { RESERVED_BUTTONS } from 'src/domain/messaging/messaging-buttons.const';

const RESERVED_NAMES = new Set<string>(RESERVED_LIST.map((v) => v.name));
const ALLOW_USE_NAMES = new Set<string>(
  RESERVED_LIST.filter((v) => v.allowUse).map((v) => v.name),
);

/** Teto de variáveis por tipo — JSON sem teto é porta de DoS (ver page-layout.dto.ts). */
export const MAX_TEMPLATE_VARIABLES = 32;

export const TemplateVariableSchema = z
  .object({
    // Meta exige [a-z_]; camelCase é recusado aqui, sem normalização silenciosa.
    name: z
      .string()
      .regex(/^[a-z][a-z0-9_]*$/, 'nome deve ser snake_case ([a-z][a-z0-9_]*)'),
    type: z.enum(['STRING', 'NUMBER', 'DATE']),
    required: z.boolean().default(true),
    default: z.string().min(1).optional(),
    format: z.string().optional(),
    /** true = reservada do sistema liberada neste tipo (só o nome importa; o resto vem do código). */
    reserved: z.boolean().optional(),
    /** true = o valor fica mascarado no histórico de mensagens (ex.: código de verificação). */
    sensitive: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    // required=false: a Meta nunca sabe que a variável é opcional — nós substituímos pelo default.
    if (value.reserved) {
      if (!ALLOW_USE_NAMES.has(value.name)) {
        ctx.addIssue({
          code: 'custom',
          path: ['name'],
          message: `"${value.name}" não é uma variável reservada liberável`,
        });
      }
      return;
    }
    if (value.required === false && !value.default) {
      ctx.addIssue({
        code: 'custom',
        path: ['default'],
        message: 'variável opcional exige default não-vazio',
      });
    }
    // Reservada é global e preenchida pelo sistema — um tipo não pode redeclará-la.
    if (RESERVED_NAMES.has(value.name)) {
      ctx.addIssue({
        code: 'custom',
        path: ['name'],
        message: `"${value.name}" é uma variável reservada do sistema`,
      });
    }
  });

export const TemplateVariablesSchema = z
  .array(TemplateVariableSchema)
  .max(MAX_TEMPLATE_VARIABLES);

export type TemplateVariable = z.infer<typeof TemplateVariableSchema>;

/** Teto de botões tipados por tipo (mesmo teto de botões por template da Meta). */
export const MAX_TEMPLATE_BUTTON_SLOTS = 10;

export const TemplateButtonSlotSchema = z
  .object({
    key: z
      .string()
      .regex(/^[a-z][a-z0-9_]*$/, 'chave deve ser snake_case ([a-z][a-z0-9_]*)')
      .max(40),
    kind: z.enum(['QUICK_REPLY', 'URL']),
    reserved: z.boolean().optional(),
    required: z.boolean().default(true),
    urlBase: z.string().max(500).optional(),
    sensitive: z.boolean().optional(),
  })
  .superRefine((slot, ctx) => {
    const reservedKeys = Object.keys(RESERVED_BUTTONS);
    if (slot.reserved) {
      const declared =
        RESERVED_BUTTONS[slot.key as keyof typeof RESERVED_BUTTONS];
      if (!declared?.allowUse) {
        ctx.addIssue({
          code: 'custom',
          path: ['key'],
          message: `"${slot.key}" não é um botão reservado liberável`,
        });
      } else if (declared.kind !== slot.kind) {
        ctx.addIssue({
          code: 'custom',
          path: ['kind'],
          message: `"${slot.key}" é ${declared.kind}`,
        });
      }
      return;
    }
    if (reservedKeys.includes(slot.key)) {
      ctx.addIssue({
        code: 'custom',
        path: ['key'],
        message: `"${slot.key}" é um botão reservado do sistema`,
      });
    }
    if (slot.kind === 'URL') {
      if (!slot.urlBase || !/^https?:\/\/[^\s{}]+$/.test(slot.urlBase)) {
        ctx.addIssue({
          code: 'custom',
          path: ['urlBase'],
          message: 'urlBase deve ser uma URL http(s) sem variáveis',
        });
      }
    } else if (slot.urlBase) {
      ctx.addIssue({
        code: 'custom',
        path: ['urlBase'],
        message: 'urlBase só vale para botões URL',
      });
    }
  });

export const TemplateButtonSlotsSchema = z
  .array(TemplateButtonSlotSchema)
  .max(MAX_TEMPLATE_BUTTON_SLOTS)
  .superRefine((slots, ctx) => {
    const keys = slots.map((s) => s.key);
    if (new Set(keys).size !== keys.length) {
      ctx.addIssue({ code: 'custom', message: 'chaves de botão repetidas' });
    }
    // Mesmos limites de template da Meta: 2 links, e (hoje) só URL/resposta rápida entram como espaço.
    if (slots.filter((s) => s.kind === 'URL').length > 2) {
      ctx.addIssue({
        code: 'custom',
        message: 'no máximo 2 botões URL por tipo',
      });
    }
  });

export type TemplateButtonSlotInput = z.infer<typeof TemplateButtonSlotSchema>;

/** Nome de variável e chave de botão URL dividem o mesmo `{{ nome }}` na URL: não podem colidir. */
export function assertSlotKeysFreeOfVariables(
  slots: readonly { key: string; reserved?: boolean }[],
  variables: readonly { name: string }[],
): string | null {
  const names = new Set(variables.map((v) => v.name));
  const clash = slots.find((s) => !s.reserved && names.has(s.key));
  return clash
    ? `a chave do botão "${clash.key}" colide com uma variável do tipo`
    : null;
}

export const CreateMessagingTemplateTypeSchema = z
  .object({
    key: z.string().min(1).max(100),
    name: z.string().min(1).max(200),
    variables: TemplateVariablesSchema.default([]),
    buttons: TemplateButtonSlotsSchema.default([]),
  })
  .superRefine((value, ctx) => {
    const clash = assertSlotKeysFreeOfVariables(value.buttons, value.variables);
    if (clash)
      ctx.addIssue({ code: 'custom', path: ['buttons'], message: clash });
  });

export const UpdateMessagingTemplateTypeSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  variables: TemplateVariablesSchema.optional(),
  buttons: TemplateButtonSlotsSchema.optional(),
});

export class CreateMessagingTemplateTypeDto extends createZodDto(
  CreateMessagingTemplateTypeSchema,
) {
  @ApiProperty({ example: 'ORDER_UPDATE' })
  key: string;

  @ApiProperty({ example: 'Atualização de pedido' })
  name: string;

  @ApiProperty({ type: 'array', items: { type: 'object' }, default: [] })
  variables: TemplateVariable[];

  @ApiProperty({
    type: 'array',
    items: { type: 'object' },
    default: [],
    description:
      'Botões tipados: [{ key, kind: QUICK_REPLY|URL, reserved?, required?, urlBase?, sensitive? }]',
  })
  buttons: TemplateButtonSlotInput[];
}

export class UpdateMessagingTemplateTypeDto extends createZodDto(
  UpdateMessagingTemplateTypeSchema,
) {
  @ApiPropertyOptional({ example: 'Atualização de pedido' })
  name?: string;

  @ApiPropertyOptional({ type: 'array', items: { type: 'object' } })
  variables?: TemplateVariable[];

  @ApiPropertyOptional({ type: 'array', items: { type: 'object' } })
  buttons?: TemplateButtonSlotInput[];
}

export class MessagingTemplateTypeDto {
  @ApiProperty() id: string;
  @ApiProperty() key: string;
  @ApiProperty() name: string;
  @ApiProperty({ type: 'array', items: { type: 'object' } })
  variables: TemplateVariable[];
  @ApiProperty({ type: 'array', items: { type: 'object' } })
  buttons: TemplateButtonSlotInput[];
  @ApiPropertyOptional({
    description:
      'Quantos templates usam este tipo (listagem e detalhe); bloqueia a exclusão',
  })
  templatesCount?: number;
  @ApiPropertyOptional({
    description: 'true = tipo exclusivo do sistema (não pode ser excluído)',
  })
  isSystem?: boolean;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt: Date;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt: Date;
}

/** Variável reservada do sistema, como o front a lê — sem `resolve` nem `fallback`. */
export class MessagingTemplateVariableDto {
  @ApiProperty({ example: 'first_name' }) name: string;
  @ApiProperty({ enum: ['STRING', 'NUMBER', 'DATE'] }) type:
    'STRING' | 'NUMBER' | 'DATE';
  @ApiProperty({ example: 'variable.first_name' }) labelKey: string;
  @ApiProperty({ example: 'Ana', description: 'Valor fictício do preview' })
  dummy: string;
  @ApiProperty({ description: 'true = o valor fica mascarado no histórico' })
  sensitive: boolean;
  @ApiProperty({
    description: 'true = o operador pode liberá-la num tipo de template',
  })
  allowUse: boolean;
  @ApiProperty({
    description:
      'true = o chamador fornece o valor; false = derivada do contexto',
  })
  callerProvided: boolean;
}

/** Botão reservado do sistema, como o front o lê. */
export class MessagingReservedButtonDto {
  @ApiProperty({ example: 'opt_out' }) key: string;
  @ApiProperty({ enum: ['QUICK_REPLY'] }) kind: 'QUICK_REPLY';
  @ApiProperty({ example: 'button.opt_out' }) labelKey: string;
  @ApiProperty({ example: 'Parar de receber' }) defaultLabel: string;
  @ApiProperty() allowUse: boolean;
}

/** Handler registrado em código; `type` nulo = vale para qualquer tipo. */
export class MessagingButtonHandlerDto {
  @ApiPropertyOptional({ type: String, nullable: true }) type: string | null;
  @ApiProperty() button: string;
}

export class MessagingTemplateButtonsInfoDto {
  @ApiProperty({ type: [MessagingReservedButtonDto] })
  reserved: MessagingReservedButtonDto[];
  @ApiProperty({ type: [MessagingButtonHandlerDto] })
  handlers: MessagingButtonHandlerDto[];
}
