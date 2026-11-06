import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import type {
  ResolvedTemplate,
  TemplateButton,
  TemplateHeader,
} from 'src/domain/interface/messaging-provider.interface';
import {
  SENSITIVE_MASK,
  effectiveVariables,
  resolveReserved,
  sensitiveNames,
  splitTypeVariables,
  type ReservedValues,
  type VariableContext,
} from 'src/domain/messaging/messaging-variables.const';
import {
  buttonSlotVariables,
  effectiveButtonSlots,
  resolveButtons,
  sensitiveButtonNames,
  type ButtonValues,
  type StoredTypeButton,
} from 'src/domain/messaging/messaging-buttons.const';
import type { TemplateVariable } from './dto/messaging-template-type.dto';
import { normalizePhone } from './providers/phone.util';
import {
  assertAllResolved,
  catalogName,
  formatValues,
  renderBody,
} from './providers/template.util';

/** Qual template do catálogo: pelo id, ou por `key` (+ idioma; padrão pt-BR) — o que outro módulo conhece. */
export interface TemplateRef {
  templateId?: string;
  key?: string;
  language?: string;
}

export interface ResolveTemplateInput extends TemplateRef {
  phone: string;
  /** Variáveis custom do tipo, por nome. */
  values?: Record<string, string>;
  /** Reservadas informadas pelo chamador (chave + dado bruto); só código interno passa isto. */
  reserved?: ReservedValues;
  /** Botões tipados do tipo, por chave; chave que o template não tem é erro. */
  buttons?: ButtonValues;
  /** `false` recusa template com variável `sensitive` (ex.: agente de IA: o valor passaria pela conversa). */
  allowSensitive?: boolean;
  /** URL da imagem para header IMAGE; obrigatório quando o template tem `header.kind === 'IMAGE'`. */
  headerImageUrl?: string;
}

export interface ResolvedTemplateRef {
  templateId: string;
  resolved: ResolvedTemplate;
  bypassOptOut: boolean;
}

const DEFAULT_LANGUAGE = 'pt-BR';

/** `template do catálogo + dados` → `ResolvedTemplate`: o domínio nunca vê o id da nossa tabela. */
@Injectable()
export class MessagingTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  /** Existe e está pronto pra enviar, sem checar aprovação por provider (isso é por conexão). */
  async isUsable(
    key: string,
    language: string = DEFAULT_LANGUAGE,
  ): Promise<boolean> {
    const row = await this.prisma.messagingTemplate.findUnique({
      where: { key_language: { key, language } },
    });
    return !!row && !row.invalidatedAt;
  }

  async resolve(input: ResolveTemplateInput): Promise<ResolvedTemplateRef> {
    const row = await this.find(input);
    // O tipo mudou e este template ainda não foi ajustado: enviar agora mandaria um texto que o
    // contrato atual não garante (variável sem valor, botão faltando).
    if (row.invalidatedAt) {
      throw new BadRequestException(
        `template ${row.key} (${row.language}) requer ajuste: ${row.invalidReason ?? 'o tipo foi alterado'}`,
      );
    }

    const phone = normalizePhone(input.phone);
    const contact = await this.prisma.messagingContact.findUnique({
      where: { phone },
      select: { name: true, pushName: true },
    });
    const ctx: VariableContext = {
      contact: contact ? { ...contact, phone } : null,
      connection: { phone: null },
      now: new Date(),
    };

    const stored = row.type.variables as unknown as TemplateVariable[];
    const { reservedNames } = splitTypeVariables(stored);
    // Reservada VENCE o que veio em `values` — sem isso quem chama a API forjaria first_name.
    const merged = {
      ...input.values,
      ...resolveReserved(ctx, reservedNames, input.reserved),
    };

    // Botões tipados: só os espaços que ESTE template realmente usa entram no envio.
    const rowButtons =
      (row.buttons as unknown as TemplateButton[] | null) ?? [];
    const usedSlots = effectiveButtonSlots(
      row.type.buttons as unknown as StoredTypeButton[],
    ).filter((slot) => rowButtons.some((b) => b.slot === slot.key));
    const { values: buttonValues, payloads } = resolveButtons(
      usedSlots,
      input.buttons,
    );

    const values = formatValues(
      [...effectiveVariables(stored), ...buttonSlotVariables(usedSlots)],
      { ...merged, ...buttonValues },
    );

    const parts = {
      body: row.body,
      header: row.header as unknown as TemplateHeader | null,
      footer: row.footer,
      buttons: row.buttons as unknown as TemplateButton[] | null,
    };
    assertAllResolved(parts, values);

    const masked = [
      ...sensitiveNames(stored),
      ...sensitiveButtonNames(usedSlots),
    ].filter((name) => name in values);
    if (masked.length > 0 && input.allowSensitive === false) {
      throw new BadRequestException(
        `template com variável sensível (${masked.join(', ')}) só pode ser enviado por código`,
      );
    }
    return {
      templateId: row.id,
      bypassOptOut: row.bypassOptOut,
      resolved: {
        name: catalogName(row.key),
        language: row.language,
        category: row.category,
        values,
        body: renderBody(row.body, values),
        bodySource: row.body,
        header:
          parts.header?.kind === 'IMAGE' && input.headerImageUrl
            ? { kind: 'IMAGE' as const, url: input.headerImageUrl }
            : (parts.header ?? undefined),
        footer: row.footer ?? undefined,
        buttons: parts.buttons
          ? parts.buttons.map((button) =>
              button.kind === 'QUICK_REPLY' &&
              button.slot &&
              payloads[button.slot]
                ? { ...button, payload: payloads[button.slot] }
                : button,
            )
          : undefined,
        ...(masked.length > 0
          ? { redacted: this.redact(row.body, values, masked) }
          : {}),
      },
    };
  }

  private redact(
    body: string,
    values: Record<string, string>,
    names: string[],
  ) {
    const maskedValues = { ...values };
    for (const name of names) maskedValues[name] = SENSITIVE_MASK;
    return {
      body: renderBody(body, maskedValues),
      values: maskedValues,
      names,
    };
  }

  private async find(ref: TemplateRef) {
    const include = { type: true } as const;
    const row = ref.templateId
      ? await this.prisma.messagingTemplate.findUnique({
          where: { id: ref.templateId },
          include,
        })
      : ref.key
        ? await this.prisma.messagingTemplate.findUnique({
            where: {
              key_language: {
                key: ref.key,
                language: ref.language ?? DEFAULT_LANGUAGE,
              },
            },
            include,
          })
        : null;
    if (!row) {
      throw new NotFoundException(
        `template ${ref.templateId ?? `${ref.key}/${ref.language ?? DEFAULT_LANGUAGE}`} não encontrado`,
      );
    }
    return row;
  }
}
