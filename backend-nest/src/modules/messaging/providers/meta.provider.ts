import { createHmac } from 'crypto';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import type {
  DownloadedMedia,
  IMessagingProvider,
  IMessagingService,
  MediaFile,
  MediaLookup,
  MessagingCapabilities,
  RemoteTemplateStatus,
  ResolvedTemplate,
  SendMessageInput,
  SendResult,
  TemplateButton,
  TemplateDefinition,
  MessagingEvent,
  WebhookRequest,
} from 'src/domain/interface/messaging-provider.interface';
import { UnsupportedMessageTypeError } from 'src/domain/interface/messaging-provider.interface';
import type { ProviderResult } from 'src/domain/interface/provider-result';
import {
  DEFAULT_GRAPH_VERSION,
  MESSAGING_MESSAGE_TYPES,
  MessagingMessageTypeConst,
  MessagingProviderConst,
  type MessagingStoredType,
} from 'src/domain/messaging/messaging.const';
import { normalizePhone } from './phone.util';
import {
  extensionFromMime,
  failureResult,
  PROVIDER_TRANSFER_TIMEOUT_MS,
  providerFetch,
  uploadTimeoutMs,
  readJson,
  requestJson,
  resultFromResponse,
} from './provider-http.util';
import {
  META_STATUS,
  META_TEMPLATE_STATUS,
  timingSafeCompare,
  toDate,
} from './webhook.util';
import { compactPlaceholders, extractPlaceholders } from './template.util';

/** Meta exige 1–90 min; sem um TTL de OTP já existente no sistema, assume o default mais comum. */
const AUTH_CODE_EXPIRATION_MINUTES = 10;

/** BCP 47 (nosso, `pt-BR`) → código de idioma de template da Meta, que usa a forma POSIX (`pt_BR`). */
export const toMetaLanguage = (code: string) => code.replace('-', '_');

/** Inverso de `toMetaLanguage` — usado na reconciliação (`GET .../message_templates`), que devolve `pt_BR`. */
export const fromMetaLanguage = (code: string) => code.replace('_', '-');

interface MetaStatus {
  id?: string;
  status?: string;
  timestamp?: string;
}

interface MetaMediaRef {
  id?: string;
  mime_type?: string;
  caption?: string;
  filename?: string;
}

interface MetaMessage {
  id: string;
  from: string;
  type?: string;
  timestamp?: string;
  text?: { body?: string };
  /** Mensagem à qual esta responde (resposta rápida e botões sempre trazem). */
  context?: { id?: string; from?: string };
  /** Toque numa resposta rápida de TEMPLATE (type "button"). */
  button?: { text?: string; payload?: string };
  /** Toque num botão/lista de mensagem interativa (type "interactive"). */
  interactive?: {
    type?: string;
    button_reply?: { id?: string; title?: string };
    list_reply?: { id?: string; title?: string };
  };
  image?: MetaMediaRef;
  video?: MetaMediaRef;
  document?: MetaMediaRef;
  audio?: MetaMediaRef;
  sticker?: MetaMediaRef;
}

interface MetaChangeValue {
  contacts?: { wa_id: string; profile?: { name?: string } }[];
  messages?: MetaMessage[];
  statuses?: MetaStatus[];
}

interface MetaTemplateCategoryValue {
  message_template_id?: number | string;
  message_template_name?: string;
  message_template_language?: string;
  previous_category?: string;
  new_category?: string;
}

const META_CATEGORIES = ['AUTHENTICATION', 'UTILITY', 'MARKETING'] as const;
type MetaCategory = (typeof META_CATEGORIES)[number];
const asCategory = (value: string | undefined): MetaCategory | undefined =>
  META_CATEGORIES.find((c) => c === value?.toUpperCase());

interface MetaTemplateStatusValue {
  event?: string;
  message_template_id?: number | string;
  message_template_name?: string;
  message_template_language?: string;
  reason?: string;
}

export const metaConfigSchema = z.object({
  phoneNumberId: z
    .string()
    .regex(/^\d+$/, 'phoneNumberId deve conter só dígitos'),
  accessToken: z.string().min(1),
  appSecret: z.string().optional(),
  verifyToken: z.string().optional(),
  graphVersion: z
    .string()
    .regex(/^v\d+\.\d+$/, "graphVersion deve ser no formato 'v21.0'")
    .default(DEFAULT_GRAPH_VERSION),
  appId: z.string().optional(),
  wabaId: z.string().min(1),
});
export type MetaConfig = z.infer<typeof metaConfigSchema>;

interface TemplatePayloadShape {
  name?: string;
  language?: { code?: string };
  components?: {
    type: string;
    sub_type?: string;
    index?: string;
    parameters?: { type?: string; parameter_name?: string }[];
  }[];
}

/** Formato do template enviado, sem os valores (código OTP, nomes): seguro para exibir e logar. */
export function describeTemplatePayload(
  template: TemplatePayloadShape,
): string {
  const components = (template.components ?? []).map((c) => {
    const where = [c.sub_type, c.index !== undefined ? `#${c.index}` : '']
      .filter(Boolean)
      .join('');
    const params = (c.parameters ?? [])
      .map((p) =>
        p.parameter_name ? `${p.type}:${p.parameter_name}` : (p.type ?? '?'),
      )
      .join(',');
    return `${c.type}${where ? `(${where})` : ''}[${params}]`;
  });
  return `${template.name} ${template.language?.code} ${components.join(' ') || 'sem components'}`;
}

/** Normaliza o valor do parâmetro removendo quebra de linha, tab e espaços excessivos. */
export function sanitizeParameter(value: string): string {
  return value
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/ {5,}/g, '    ')
    .trim();
}

const GRAPH_HOST = 'https://graph.facebook.com';

/** WhatsApp Cloud API. Bearer + system user token, sem OAuth — ver docs/backend/messaging.md. */
@Injectable()
export class MetaProvider implements IMessagingService<MetaConfig> {
  readonly configSchema = metaConfigSchema;
  readonly configFields = [
    'phoneNumberId',
    'accessToken',
    'appSecret',
    'verifyToken',
    'graphVersion',
    'appId',
    'wabaId',
  ] as const;
  readonly secretFields = ['accessToken', 'appSecret', 'verifyToken'] as const;
  readonly messagingCapabilities: MessagingCapabilities = {
    messageTypes: MESSAGING_MESSAGE_TYPES,
    template: {
      approval: true,
      providerOwnedBody: ['AUTHENTICATION'],
      components: {
        header: ['TEXT', 'IMAGE'],
        footer: true,
        buttons: ['QUICK_REPLY', 'URL', 'PHONE_NUMBER', 'COPY_CODE'],
      },
    },
    voiceRecording: false,
    typing: { inbound: false, outbound: false },
    serviceWindowHours: 24,
  };

  use(cfg: MetaConfig): IMessagingProvider {
    return {
      capabilities: () => this.messagingCapabilities,
      send: (input) => this._send(cfg, input),
      downloadMedia: (lookup) => this._downloadMedia(cfg, lookup),
      accountPhone: () => this._accountPhone(cfg),
      validateConfiguration: () => this._validate(cfg),
      verifyWebhook: (req) => this._verifyWebhook(cfg, req),
      verifyChallenge: (query) => this._verifyChallenge(cfg, query),
      parseWebhook: (body) => this._parseWebhook(body),
      registerWebhook: (url) => this._registerWebhook(cfg, url),
      submitTemplate: (definition, providerTemplateId) =>
        this._submitTemplate(cfg, definition, providerTemplateId),
      deleteRemoteTemplate: (name, providerTemplateId) =>
        this._deleteRemoteTemplate(cfg, name, providerTemplateId),
      fetchTemplateStatuses: () => this._fetchTemplateStatuses(cfg),
    };
  }

  private graph(cfg: MetaConfig, path: string): string {
    return `${GRAPH_HOST}/${cfg.graphVersion}/${path}`;
  }

  private auth(cfg: MetaConfig): Record<string, string> {
    return { Authorization: `Bearer ${cfg.accessToken}` };
  }

  private async _send(
    cfg: MetaConfig,
    input: SendMessageInput,
  ): Promise<SendResult> {
    // Upload primeiro: a Meta só referencia mídia por `link` ou por `id` de um upload prévio.
    const file = 'file' in input ? input.file : undefined;
    const mediaRef = file
      ? await this.uploadMedia(cfg, file, input)
      : undefined;

    const content = this.buildContent(input, mediaRef);
    let body: { messages?: { id?: string }[] } | null;
    try {
      body = (await requestJson(
        'Meta',
        this.graph(cfg, `${cfg.phoneNumberId}/messages`),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...this.auth(cfg) },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: normalizePhone(input.phone),
            ...content,
          }),
        },
      )) as { messages?: { id?: string }[] } | null;
    } catch (error) {
      // "Invalid parameter"/"parameters do not match" não dizem o que foi enviado: anexa o formato
      // (sem valores) para comparar com os componentes do template aprovado.
      if (input.type !== MessagingMessageTypeConst.TEMPLATE) throw error;
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(
        `${reason} [enviado: ${describeTemplatePayload(content.template as TemplatePayloadShape)}]`,
      );
    }

    const id = body?.messages?.[0]?.id;
    if (!id) {
      throw new Error('Meta aceitou o envio sem devolver messages[0].id');
    }
    return { providerMessageId: id, acceptedAt: new Date(), mediaRef };
  }

  private async uploadMedia(
    cfg: MetaConfig,
    file: MediaFile,
    input: SendMessageInput,
  ): Promise<string> {
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('type', file.mimeType);
    form.append(
      'file',
      new Blob([new Uint8Array(file.data)], { type: file.mimeType }),
      'fileName' in input
        ? input.fileName
        : `file.${extensionFromMime(file.mimeType)}`,
    );

    const body = (await requestJson(
      'Meta',
      this.graph(cfg, `${cfg.phoneNumberId}/media`),
      { method: 'POST', headers: this.auth(cfg), body: form },
      uploadTimeoutMs(file.data.length),
    )) as { id?: string } | null;
    if (!body?.id) throw new Error('Meta aceitou o upload sem devolver id');
    return body.id;
  }

  /** A mídia nunca vem na mensagem — só um `id`; resolver a URL e baixar gasta duas chamadas. */
  private async _downloadMedia(
    cfg: MetaConfig,
    lookup: MediaLookup,
  ): Promise<DownloadedMedia> {
    const stored = lookup.raw as Record<string, unknown> | null;
    const ref =
      (stored?.mediaRef as string | undefined) ??
      this.mediaOf(stored as MetaMessage | null)?.id;
    if (!ref) throw new Error('Meta: mensagem sem referência de mídia');

    const info = (await requestJson('Meta', this.graph(cfg, ref), {
      headers: this.auth(cfg),
    })) as { url?: string; mime_type?: string } | null;
    if (!info?.url) throw new Error('Meta não devolveu a URL da mídia');

    const res = await providerFetch(
      info.url,
      { headers: this.auth(cfg) },
      PROVIDER_TRANSFER_TIMEOUT_MS,
    );
    if (!res.ok) throw new Error(`Meta ${res.status}: ${res.statusText}`);
    return {
      data: Buffer.from(await res.arrayBuffer()),
      mimeType: info.mime_type ?? 'application/octet-stream',
    };
  }

  /** Envelope por tipo; aqui `TEMPLATE` é o real — fora da janela de 24h exige template aprovado. */
  private buildContent(
    input: SendMessageInput,
    mediaRef?: string,
  ): Record<string, unknown> {
    // Upload prévio vira `id`; sem ele, a Meta baixa o `link`.
    const media = mediaRef
      ? { id: mediaRef }
      : { link: 'mediaUrl' in input ? input.mediaUrl : undefined };
    switch (input.type) {
      case MessagingMessageTypeConst.TEXT:
        return { type: 'text', text: { body: input.text } };

      case MessagingMessageTypeConst.IMAGE:
        return {
          type: 'image',
          image: { ...media, caption: input.caption },
        };

      case MessagingMessageTypeConst.VIDEO:
        return {
          type: 'video',
          video: { ...media, caption: input.caption },
        };

      case MessagingMessageTypeConst.AUDIO:
        // A Meta não aceita caption em áudio.
        return { type: 'audio', audio: media };

      case MessagingMessageTypeConst.DOCUMENT:
        return {
          type: 'document',
          document: {
            ...media,
            filename: input.fileName,
            caption: input.caption,
          },
        };

      case MessagingMessageTypeConst.TEMPLATE:
        return {
          type: 'template',
          template: this.buildTemplatePayload(input.template),
        };

      default:
        throw new UnsupportedMessageTypeError(
          MessagingProviderConst.META,
          (input as { type: string }).type,
        );
    }
  }

  /** Nome do catálogo + idioma + parâmetros nomeados; nunca reenvia o texto, a Meta já tem o aprovado. */
  private buildTemplatePayload(
    template: ResolvedTemplate,
  ): Record<string, unknown> {
    if (template.category === 'AUTHENTICATION') {
      return this.authenticationPayload(template);
    }

    const components: Record<string, unknown>[] = [];

    if (template.header?.kind === 'TEXT') {
      const parameters = this.namedParameters(
        template.header.text,
        template.values,
      );
      if (parameters.length) components.push({ type: 'header', parameters });
    } else if (template.header?.kind === 'IMAGE') {
      components.push({
        type: 'header',
        parameters: [{ type: 'image', image: { link: template.header.url } }],
      });
    }

    const bodyParameters = this.namedParameters(
      template.bodySource ?? template.body,
      template.values,
    );
    if (bodyParameters.length)
      components.push({ type: 'body', parameters: bodyParameters });

    // `index` é a posição entre TODOS os botões do template, na ordem em que foi submetido.
    (template.buttons ?? []).forEach((button, index) => {
      if (button.kind === 'QUICK_REPLY' && button.payload) {
        // O payload só existe no envio (não passa pela aprovação) e volta no webhook do toque.
        components.push({
          type: 'button',
          sub_type: 'quick_reply',
          index: String(index),
          parameters: [{ type: 'payload', payload: button.payload }],
        });
        return;
      }
      if (button.kind !== 'URL') return;
      const parameters = this.namedParameters(button.url, template.values);
      if (parameters.length) {
        components.push({
          type: 'button',
          sub_type: 'url',
          index: String(index),
          parameters,
        });
      }
    });

    return {
      name: template.name,
      language: { code: toMetaLanguage(template.language) },
      ...(components.length ? { components } : {}),
    };
  }

  /** AUTHENTICATION usa o corpo fixo da Meta: um parâmetro posicional no corpo e o mesmo código no botão. */
  private authenticationPayload(
    template: ResolvedTemplate,
  ): Record<string, unknown> {
    const [codeName] = extractPlaceholders(
      template.bodySource ?? template.body,
    );
    const code = (codeName ? template.values[codeName] : undefined) ?? '';
    return {
      name: template.name,
      language: { code: toMetaLanguage(template.language) },
      components: [
        { type: 'body', parameters: [{ type: 'text', text: code }] },
        {
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [{ type: 'text', text: code }],
        },
      ],
    };
  }

  /** `parameter_name` elimina a ordem como contrato — editar o tipo não corrompe template aprovado. */
  private namedParameters(
    text: string,
    values: Record<string, string>,
  ): Record<string, unknown>[] {
    return extractPlaceholders(text).map((name) => ({
      type: 'text',
      parameter_name: name,
      text: sanitizeParameter(values[name] ?? ''),
    }));
  }

  /** `display_phone_number` do número cadastrado — é o telefone que a conexão passa a representar. */
  private async _accountPhone(cfg: MetaConfig): Promise<string | null> {
    const body = (await requestJson(
      'Meta',
      this.graph(cfg, `${cfg.phoneNumberId}?fields=display_phone_number`),
      { headers: this.auth(cfg) },
    )) as { display_phone_number?: string } | null;
    const digits = body?.display_phone_number?.replace(/\D/g, '');
    return digits ? normalizePhone(digits) : null;
  }

  /** Sonda o par token × número: token de outra conta reprova mesmo com phoneNumberId válido. */
  private async _validate(cfg: MetaConfig): Promise<ProviderResult> {
    try {
      const res = await providerFetch(
        this.graph(
          cfg,
          `${cfg.phoneNumberId}?fields=verified_name,display_phone_number`,
        ),
        { headers: this.auth(cfg) },
      );

      const body = await readJson(res);
      if (!res.ok) return resultFromResponse(res, body, '');

      const info = body as {
        verified_name?: string;
        display_phone_number?: string;
      } | null;
      return {
        status: true,
        data:
          [info?.verified_name, info?.display_phone_number]
            .filter(Boolean)
            .join(' · ') || 'ok',
      };
    } catch (error) {
      return failureResult(error);
    }
  }

  /** HMAC-SHA256 do corpo CRU com o app secret — reserializar o JSON invalida a assinatura. */
  private _verifyWebhook(cfg: MetaConfig, req: WebhookRequest): boolean {
    if (!cfg.appSecret) return true;
    const header = req.headers['x-hub-signature-256'] ?? '';
    const expected =
      'sha256=' +
      createHmac('sha256', cfg.appSecret).update(req.raw).digest('hex');
    return timingSafeCompare(header, expected);
  }

  /** Handshake de inscrição: a Meta chama o GET antes de aceitar o webhook. */
  private _verifyChallenge(
    cfg: MetaConfig,
    query: Record<string, string | undefined>,
  ): string | null {
    if (!cfg.verifyToken) return null;
    const ok =
      query['hub.mode'] === 'subscribe' &&
      timingSafeCompare(query['hub.verify_token'] ?? '', cfg.verifyToken);
    return ok ? (query['hub.challenge'] ?? '') : null;
  }

  private _parseWebhook(body: unknown): MessagingEvent[] {
    const entries =
      (
        body as {
          entry?: { changes?: { field?: string; value?: unknown }[] }[];
        } | null
      )?.entry ?? [];

    return entries.flatMap((entry) =>
      (entry.changes ?? []).flatMap((change) => this.parseChange(change)),
    );
  }

  private parseChange(change: {
    field?: string;
    value?: unknown;
  }): MessagingEvent[] {
    if (change.field === 'message_template_status_update') {
      return this.parseTemplateStatus(
        change.value as MetaTemplateStatusValue | undefined,
      );
    }
    if (change.field === 'template_category_update') {
      return this.parseTemplateCategory(
        change.value as MetaTemplateCategoryValue | undefined,
      );
    }
    const value = change.value as MetaChangeValue | undefined;
    return value
      ? [...this.parseMessages(value), ...this.parseStatuses(value)]
      : [];
  }

  /** `IN_APPEAL`/`PENDING` sem casar vocabulário é descartado — reconciliação sob demanda cobre o resto. */
  private parseTemplateStatus(
    value: MetaTemplateStatusValue | undefined,
  ): MessagingEvent[] {
    const status = META_TEMPLATE_STATUS[value?.event ?? ''];
    if (
      !value?.message_template_id ||
      !value.message_template_name ||
      !status
    ) {
      return [];
    }
    return [
      {
        kind: 'TEMPLATE_STATUS',
        providerTemplateId: String(value.message_template_id),
        name: value.message_template_name,
        language: fromMetaLanguage(value.message_template_language ?? ''),
        status,
        reason: value.reason,
      },
    ];
  }

  private parseTemplateCategory(
    value: MetaTemplateCategoryValue | undefined,
  ): MessagingEvent[] {
    const newCategory = asCategory(value?.new_category);
    if (
      !value?.message_template_id ||
      !value.message_template_name ||
      !newCategory
    ) {
      return [];
    }
    return [
      {
        kind: 'TEMPLATE_CATEGORY',
        providerTemplateId: String(value.message_template_id),
        name: value.message_template_name,
        language: fromMetaLanguage(value.message_template_language ?? ''),
        previousCategory: asCategory(value.previous_category),
        newCategory,
      },
    ];
  }

  private mediaOf(message: MetaMessage | null): MetaMediaRef | undefined {
    return (
      message?.image ??
      message?.video ??
      message?.document ??
      message?.audio ??
      message?.sticker
    );
  }

  private parseMessages(value: MetaChangeValue): MessagingEvent[] {
    const nameByWaId = new Map(
      (value.contacts ?? []).map((c) => [c.wa_id, c.profile?.name]),
    );

    return (value.messages ?? []).flatMap((m): MessagingEvent[] => {
      // Reação não é conversa: sem mensagem própria para exibir.
      if (!m.id || !m.from || m.type === 'reaction') return [];
      const media = this.mediaOf(m);
      const tapped = this.tappedText(m);
      return [
        {
          kind: 'MESSAGE',
          providerMessageId: m.id,
          phone: normalizePhone(m.from),
          pushName: nameByWaId.get(m.from) ?? undefined,
          // Toque em botão é a resposta do cliente: aparece no chat como texto, não como "não suportada".
          type: tapped
            ? MessagingMessageTypeConst.TEXT
            : this.storedType(m.type),
          fromMe: false,
          text: m.text?.body ?? tapped ?? media?.caption,
          replyTo: m.context?.id,
          buttonPayload: this.tappedPayload(m),
          mimeType: media?.mime_type,
          fileName: media?.filename,
          at: toDate(m.timestamp),
          raw: m,
        },
      ];
    });
  }

  /** Payload (template) ou id (interativo) do botão tocado: o que o sistema definiu no envio. */
  private tappedPayload(message: MetaMessage): string | undefined {
    return (
      message.button?.payload ??
      message.interactive?.button_reply?.id ??
      message.interactive?.list_reply?.id
    );
  }

  /** Rótulo do botão/lista que o cliente tocou (resposta rápida de template ou mensagem interativa). */
  private tappedText(message: MetaMessage): string | undefined {
    return (
      message.button?.text ??
      message.interactive?.button_reply?.title ??
      message.interactive?.list_reply?.title
    );
  }

  private storedType(type: string | undefined): MessagingStoredType {
    const upper = (type ?? MessagingMessageTypeConst.TEXT).toUpperCase();
    return upper in MessagingMessageTypeConst &&
      upper !== MessagingMessageTypeConst.TEMPLATE
      ? (upper as MessagingStoredType)
      : MessagingMessageTypeConst.UNSUPPORTED;
  }

  private parseStatuses(value: MetaChangeValue): MessagingEvent[] {
    const events: MessagingEvent[] = [];
    for (const s of value.statuses ?? []) {
      const status = META_STATUS[s.status ?? ''];
      if (!s.id || !status) continue;
      events.push({
        kind: 'STATUS',
        providerMessageId: s.id,
        status,
        at: toDate(s.timestamp),
      });
    }
    return events;
  }

  /** Cria (sem `providerTemplateId`) ou edita na WABA. Editar não troca o `name` — imutável lá. */
  private async _submitTemplate(
    cfg: MetaConfig,
    definition: TemplateDefinition,
    providerTemplateId?: string,
  ): Promise<{ providerTemplateId: string }> {
    const payload = this.buildSubmissionPayload(definition);
    const path = providerTemplateId
      ? providerTemplateId
      : `${cfg.wabaId}/message_templates`;

    const body = (await requestJson('Meta', this.graph(cfg, path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.auth(cfg) },
      body: JSON.stringify(payload),
    })) as { id?: string } | null;

    const id = providerTemplateId ?? body?.id;
    if (!id) throw new Error('Meta aceitou a submissão sem devolver id');
    return { providerTemplateId: String(id) };
  }

  /** AUTHENTICATION tem corpo fixo da Meta — nosso body/header/footer/buttons são ignorados nela. */
  private buildSubmissionPayload(
    definition: TemplateDefinition,
  ): Record<string, unknown> {
    if (definition.category === 'AUTHENTICATION') {
      return {
        name: definition.name,
        language: toMetaLanguage(definition.language),
        category: 'AUTHENTICATION',
        components: [
          { type: 'BODY', add_security_recommendation: true },
          {
            type: 'FOOTER',
            code_expiration_minutes: AUTH_CODE_EXPIRATION_MINUTES,
          },
          // COPY_CODE é o único tipo de OTP que não exige integração com o app Android.
          {
            type: 'BUTTONS',
            buttons: [{ type: 'OTP', otp_type: 'COPY_CODE' }],
          },
        ],
      };
    }

    const components: Record<string, unknown>[] = [];
    if (definition.header?.kind === 'TEXT') {
      components.push(
        this.textComponent(
          'HEADER',
          definition.header.text,
          definition.examples,
        ),
      );
    } else if (definition.header?.kind === 'IMAGE') {
      components.push({
        type: 'HEADER',
        format: 'IMAGE',
        example: { header_handle: [definition.header.url] },
      });
    }
    components.push(
      this.textComponent('BODY', definition.body, definition.examples),
    );
    if (definition.footer) {
      components.push({ type: 'FOOTER', text: definition.footer });
    }
    const buttons = (definition.buttons ?? []).map((button) =>
      this.buttonComponent(button, definition.examples),
    );
    if (buttons.length) components.push({ type: 'BUTTONS', buttons });

    return {
      name: definition.name,
      language: toMetaLanguage(definition.language),
      category: definition.category,
      // Todos os templates nascem NAMED: elimina a ordem como contrato (ver §2.4 do plano).
      parameter_format: 'NAMED',
      components,
    };
  }

  private textComponent(
    type: 'HEADER' | 'BODY',
    text: string,
    examples: Record<string, string>,
  ): Record<string, unknown> {
    const names = extractPlaceholders(text);
    const exampleKey =
      type === 'HEADER' ? 'header_text_named_params' : 'body_text_named_params';
    return {
      type,
      ...(type === 'HEADER' ? { format: 'TEXT' } : {}),
      // A Meta só reconhece `{{nome}}` colado; o `{{ nome }}` do nosso editor vira "Invalid parameter".
      text: compactPlaceholders(text),
      ...(names.length
        ? {
            example: {
              [exampleKey]: names.map((name) => ({
                param_name: name,
                example: examples[name] ?? '',
              })),
            },
          }
        : {}),
    };
  }

  private buttonComponent(
    button: TemplateButton,
    examples: Record<string, string>,
  ): Record<string, unknown> {
    switch (button.kind) {
      case 'URL': {
        const names = extractPlaceholders(button.url);
        return {
          type: 'URL',
          text: button.label,
          url: compactPlaceholders(button.url),
          ...(names.length ? { example: [examples[names[0]] ?? ''] } : {}),
        };
      }
      case 'QUICK_REPLY':
        return { type: 'QUICK_REPLY', text: button.label };
      case 'PHONE_NUMBER':
        return {
          type: 'PHONE_NUMBER',
          text: button.label,
          phone_number: button.phoneNumber,
        };
      case 'COPY_CODE':
        return { type: 'COPY_CODE', example: button.payload ?? '' };
    }
  }

  private async _deleteRemoteTemplate(
    cfg: MetaConfig,
    name: string,
    providerTemplateId?: string,
  ): Promise<ProviderResult> {
    try {
      // Só com `hsm_id` a Meta remove UM idioma; só com `name`, apaga todos os idiomas do nome.
      const query = new URLSearchParams({
        ...(providerTemplateId ? { hsm_id: providerTemplateId } : {}),
        name,
      });
      const res = await providerFetch(
        this.graph(cfg, `${cfg.wabaId}/message_templates?${query.toString()}`),
        { method: 'DELETE', headers: this.auth(cfg) },
      );
      return resultFromResponse(
        res,
        await readJson(res),
        'Template removido na Meta',
      );
    } catch (error) {
      return failureResult(error);
    }
  }

  /** Sob demanda (tela de templates), nunca por polling — ver docs/backend/messaging.md. */
  private async _fetchTemplateStatuses(
    cfg: MetaConfig,
  ): Promise<RemoteTemplateStatus[]> {
    const body = (await requestJson(
      'Meta',
      this.graph(
        cfg,
        `${cfg.wabaId}/message_templates?fields=id,name,language,status,rejected_reason,category,components`,
      ),
      { headers: this.auth(cfg) },
    )) as {
      data?: Array<{
        id?: string;
        name?: string;
        language?: string;
        status?: string;
        rejected_reason?: string;
        category?: string;
        components?: unknown[];
      }>;
    } | null;

    return (body?.data ?? []).flatMap((row): RemoteTemplateStatus[] => {
      const status = META_TEMPLATE_STATUS[row.status ?? ''];
      if (!row.id || !row.name || !row.language || !status) return [];
      return [
        {
          providerTemplateId: row.id,
          name: row.name,
          language: fromMetaLanguage(row.language),
          status,
          // 'NONE' é o "sem motivo" da Meta (aprovado/pendente) — não é texto para exibir.
          reason:
            row.rejected_reason && row.rejected_reason !== 'NONE'
              ? row.rejected_reason
              : undefined,
          category: asCategory(row.category),
          components: row.components,
        },
      ];
    });
  }

  private async _registerWebhook(
    cfg: MetaConfig,
    url: string,
  ): Promise<ProviderResult> {
    if (!cfg.appId || !cfg.appSecret || !cfg.verifyToken) {
      return {
        status: false,
        data: 'Informe appId, appSecret e verifyToken para registrar o webhook automaticamente',
      };
    }

    try {
      // Token de app: {app-id}|{app-secret}. A Meta chama o nosso GET durante esta inscrição,
      // então ela também prova que a URL pública está alcançável.
      const params = new URLSearchParams({
        object: 'whatsapp_business_account',
        callback_url: url,
        verify_token: cfg.verifyToken,
        // Sem message_template_status_update a Meta nunca avisa aprovação/reprovação de template.
        fields:
          'messages,message_template_status_update,template_category_update',
        access_token: `${cfg.appId}|${cfg.appSecret}`,
      });

      const res = await providerFetch(
        this.graph(cfg, `${cfg.appId}/subscriptions`),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
        },
      );
      const body = await readJson(res);
      if (!res.ok) return resultFromResponse(res, body, url);

      if (cfg.wabaId) {
        await providerFetch(this.graph(cfg, `${cfg.wabaId}/subscribed_apps`), {
          method: 'POST',
          headers: this.auth(cfg),
        });
      }
      return { status: true, data: url };
    } catch (error) {
      return failureResult(error);
    }
  }
}
