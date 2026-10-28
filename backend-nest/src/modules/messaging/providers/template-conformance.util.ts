import { BadRequestException } from '@nestjs/common';
import type { TemplateButton } from 'src/domain/interface/messaging-provider.interface';
import {
  assertButtonsMatchSlots,
  buttonSlotVariables,
  effectiveButtonSlots,
  type StoredTypeButton,
} from 'src/domain/messaging/messaging-buttons.const';
import { effectiveVariables } from 'src/domain/messaging/messaging-variables.const';
import type { TemplateVariable } from '../dto/messaging-template-type.dto';
import {
  assertBodyMatchesType,
  assertRequiredVariablesUsed,
} from './template.util';

/** O contrato do tipo, como está no banco (JSON). */
export interface TypeContract {
  variables: unknown;
  buttons: unknown;
}

/** O conteúdo do template que o tipo governa. */
export interface TemplateContent {
  category: string;
  body: string;
  header?: { text?: string } | null;
  footer?: string | null;
  buttons?: unknown;
}

/** Único lugar que decide se um template cumpre o tipo, usado por criação, edição e reavaliação. */
export function conformTemplateToType(
  type: TypeContract,
  content: TemplateContent,
  options: { slots?: 'enforce' | 'skip' } = {},
): { buttons: TemplateButton[] | undefined } {
  const slots = effectiveButtonSlots(type.buttons as StoredTypeButton[] | null);
  const given =
    (content.buttons as TemplateButton[] | null | undefined) ?? undefined;

  let buttons: TemplateButton[] | undefined;
  if (content.category === 'AUTHENTICATION') {
    buttons = undefined;
  } else if (options.slots === 'skip') {
    buttons = given;
  } else {
    buttons = assertButtonsMatchSlots(slots, given);
  }

  // Em autenticação os botões do tipo não se aplicam: o sufixo de link não vira variável obrigatória.
  // No modo "skip" o sufixo do link é conhecido (se o template o usa) mas não é cobrado.
  const slotVariables =
    content.category === 'AUTHENTICATION'
      ? []
      : buttonSlotVariables(slots).map((v) =>
          options.slots === 'skip' ? { ...v, required: false } : v,
        );
  const variables = [
    ...effectiveVariables((type.variables as TemplateVariable[] | null) ?? []),
    ...slotVariables,
  ];
  const parts = { ...content, buttons: buttons ?? null };
  assertBodyMatchesType(variables, parts);
  assertRequiredVariablesUsed(variables, parts);
  return { buttons };
}

/** Motivo pelo qual o template não cumpre o tipo, ou `null` se cumpre (para marcar "requer ajuste"). */
export function templateProblem(
  type: TypeContract,
  content: TemplateContent,
): string | null {
  try {
    conformTemplateToType(type, content);
    return null;
  } catch (error) {
    if (error instanceof BadRequestException) {
      const response = error.getResponse();
      const message =
        typeof response === 'string'
          ? response
          : (response as { message?: unknown }).message;

      if (
        Array.isArray(message) &&
        message.every((m) => typeof m === 'string')
      ) {
        return message.join('; ');
      }
      if (typeof message === 'string') return message;
      if (
        typeof message === 'object' &&
        message !== null &&
        'message' in message
      ) {
        const msg = (message as { message?: unknown }).message;
        return typeof msg === 'string' ? msg : error.message;
      }
      return error.message;
    }
    throw error;
  }
}
