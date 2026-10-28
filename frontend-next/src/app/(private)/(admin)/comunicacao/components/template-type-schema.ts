import { z } from 'zod';
import type { TFunc } from '@/hooks/use-translation';
import type { TemplateButtonSlot } from '@/lib/actions/messaging/types';

const NAME_RE = /^[a-z][a-z0-9_]*$/;
const URL_BASE_RE = /^https?:\/\/[^\s{}]+$/;

/** Converte string vazia do FormBuilder em array vazio nos campos de lista opcionais do schema. */
const optionalList = <T extends z.ZodTypeAny>(item: T) =>
  z.preprocess((value) => (value === '' || value == null ? [] : value), z.array(item).default([]));

/** Formulário do tipo de template (variáveis, botões e os reservados de cada um). */
export function buildTemplateTypeSchema(
  t: TFunc,
  reservedVariableNames: ReadonlySet<string>,
  reservedButtonKeys: ReadonlySet<string>,
) {
  return z
    .object({
      key: z.string().min(1, t('keyRequired')),
      name: z.string().min(1, t('nameRequired')),
      variables: optionalList(
        z.object({
          name: z
            .string()
            .min(1, t('variableNameRequired'))
            .regex(NAME_RE, t('variableNameInvalid'))
            // Trava do backend; aqui é só não deixar o usuário chegar no 400.
            .refine((name) => !reservedVariableNames.has(name), t('variableNameReserved')),
          type: z.enum(['STRING', 'NUMBER', 'DATE']),
          required: z.boolean(),
          default: z.string().optional(),
          sensitive: z.boolean().optional(),
        }),
      ),
      reservedVariables: optionalList(z.string()),
      buttons: optionalList(
        z.object({
          key: z
            .string()
            .min(1, t('buttonKeyRequired'))
            .regex(NAME_RE, t('buttonKeyInvalid'))
            .refine((key) => !reservedButtonKeys.has(key), t('buttonKeyReserved')),
          kind: z.enum(['QUICK_REPLY', 'URL']),
          required: z.boolean(),
          urlBase: z.string().optional(),
          sensitive: z.boolean().optional(),
        }),
      ),
      reservedButtons: optionalList(z.string()),
    })
    .superRefine((value, ctx) => {
      const names = new Set(value.variables.map((v: { name: string }) => v.name));
      const seen = new Set<string>();
      value.buttons.forEach((slot: TemplateButtonSlot, index: number) => {
        if (seen.has(slot.key)) {
          ctx.addIssue({ code: 'custom', path: ['buttons', index, 'key'], message: t('buttonKeyDuplicate') });
        }
        seen.add(slot.key);
        if (names.has(slot.key)) {
          ctx.addIssue({ code: 'custom', path: ['buttons', index, 'key'], message: t('buttonKeyClashVariable') });
        }
        if (slot.kind === 'URL' && !URL_BASE_RE.test(slot.urlBase ?? '')) {
          ctx.addIssue({ code: 'custom', path: ['buttons', index, 'urlBase'], message: t('buttonSlotUrlBaseInvalid') });
        }
      });
    });
}
