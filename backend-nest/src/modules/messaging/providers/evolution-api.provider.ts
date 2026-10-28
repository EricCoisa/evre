import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import type {
  ContactProfile,
  DownloadedMedia,
  IMessagingProvider,
  IMessagingService,
  MediaLookup,
  MessagingCapabilities,
  MessagingPresenceState,
  SendMessageInput,
  SendResult,
  MessagingEvent,
  MessagingSession,
  MessagingSessionStatus,
  WebhookRequest,
} from 'src/domain/interface/messaging-provider.interface';
import { UnsupportedMessageTypeError } from 'src/domain/interface/messaging-provider.interface';
import type { ProviderResult } from 'src/domain/interface/provider-result';
import {
  MESSAGING_MESSAGE_TYPES,
  MessagingMessageTypeConst,
  MessagingProviderConst,
} from 'src/domain/messaging/messaging.const';
import { firstPhoneJid, normalizePhone, phoneVariants } from './phone.util';
import { DATA_URL_PREFIX } from './media-url.util';
import {
  extensionFromMime,
  failureResult,
  providerErrorText,
  PROVIDER_TRANSFER_TIMEOUT_MS,
  providerFetch,
  uploadTimeoutMs,
  readJson,
  requestJson,
  resultFromResponse,
} from './provider-http.util';
import {
  asText,
  EVOLUTION_STATUS,
  parseBaileysMessage,
  timingSafeCompare,
  toDate,
} from './webhook.util';
import { flattenTemplate } from './template.util';

export const evolutionApiConfigSchema = z.object({
  baseUrl: z.string().url(),
  token: z.string().min(1),
  instance: z.string().min(1),
  webhookSecret: z.string().optional(),
});
export type EvolutionApiConfig = z.infer<typeof evolutionApiConfigSchema>;

/** Levemente maior que o debounce do front (~5s): evita a Evolution apagar o indicador entre uma chamada e a próxima. */
const PRESENCE_DELAY_MS = 6000;

interface EvolutionInstanceRow {
  name?: string;
  connectionStatus?: string;
  ownerJid?: string;
  instance?: { instanceName?: string; status?: string; owner?: string };
}

/** Estado da Evolution (`open` | `connecting` | `close`) no nosso vocabulário. */
function mapConnectionState(state: string | undefined): MessagingSessionStatus {
  if (state === 'open') return 'CONNECTED';
  return state === 'connecting' ? 'CONNECTING' : 'DISCONNECTED';
}

/** URL que a Evolution baixa ou, no upload, o arquivo em base64 — a rota aceita os dois no mesmo campo. */
function mediaSource(input: {
  mediaUrl?: string;
  file?: { data: Buffer };
}): string {
  return input.file
    ? input.file.data.toString('base64')
    : (input.mediaUrl ?? '');
}

/** Evolution API (Node/Baileys). Rotas incompatíveis com Evolution Go — ver docs/backend/messaging.md. */
@Injectable()
export class EvolutionApiProvider implements IMessagingService<EvolutionApiConfig> {
  readonly configSchema = evolutionApiConfigSchema;
  readonly configFields = [
    'baseUrl',
    'token',
    'instance',
    'webhookSecret',
  ] as const;
  readonly secretFields = ['token', 'webhookSecret'] as const;
  readonly messagingCapabilities: MessagingCapabilities = {
    messageTypes: MESSAGING_MESSAGE_TYPES,
    template: {
      approval: false,
      providerOwnedBody: [],
      components: { header: [], footer: false, buttons: [] },
    },
    voiceRecording: true,
    typing: { inbound: true, outbound: true },
    serviceWindowHours: null,
  };

  /** O nome da instância é nosso (UUID): nunca colide com instância de outro uso. */
  systemFields(previous?: Record<string, string>): Record<string, string> {
    return { instance: previous?.instance || randomUUID() };
  }

  use(cfg: EvolutionApiConfig): IMessagingProvider {
    return {
      capabilities: () => this.messagingCapabilities,
      session: {
        connect: () => this._connect(cfg),
        status: () => this._sessionStatus(cfg),
        disconnect: () => this._disconnect(cfg),
      },
      send: (input) => this._send(cfg, input),
      downloadMedia: (lookup) => this._downloadMedia(cfg, lookup),
      sendPresence: (phone, state) => this._sendPresence(cfg, phone, state),
      contactProfile: (phone) => this._contactProfile(cfg, phone),
      validateConfiguration: () => this._validate(cfg),
      verifyWebhook: (req) => this._verifyWebhook(cfg, req),
      parseWebhook: (body) => this._parseWebhook(cfg, body),
      registerWebhook: (url) => this._registerWebhook(cfg, url),
      unregisterWebhook: () => this._unregisterWebhook(cfg),
    };
  }

  private baseUrl(cfg: EvolutionApiConfig): string {
    return cfg.baseUrl.replace(/\/+$/, '');
  }

  private headers(cfg: EvolutionApiConfig): Record<string, string> {
    return { 'Content-Type': 'application/json', apikey: cfg.token };
  }

  private async _send(
    cfg: EvolutionApiConfig,
    input: SendMessageInput,
  ): Promise<SendResult> {
    const { path, payload } = this.buildSend(input);

    const body = await requestJson(
      'Evolution API',
      `${this.baseUrl(cfg)}/${path}/${encodeURIComponent(cfg.instance)}`,
      {
        method: 'POST',
        headers: this.headers(cfg),
        body: JSON.stringify(payload),
      },
      // Anexo por upload viaja em base64 no corpo: o prazo cresce com o tamanho.
      'file' in input && input.file
        ? uploadTimeoutMs(input.file.data.length)
        : undefined,
    );

    const id = (body as { key?: { id?: string } } | null)?.key?.id;
    if (!id) {
      throw new Error('Evolution API aceitou o envio sem devolver key.id');
    }
    return { providerMessageId: id, acceptedAt: new Date() };
  }

  /** Nome (pushName) via `findContacts`; foto via `fetchProfilePictureUrl`, por variante do número. */
  private async _contactProfile(
    cfg: EvolutionApiConfig,
    phone: string,
  ): Promise<ContactProfile | null> {
    const instance = encodeURIComponent(cfg.instance);
    const post = (path: string, payload: unknown) =>
      requestJson('Evolution API', `${this.baseUrl(cfg)}/${path}/${instance}`, {
        method: 'POST',
        headers: this.headers(cfg),
        body: JSON.stringify(payload),
      });

    let pushName: string | undefined;
    let picture: string | undefined;
    for (const variant of phoneVariants(phone)) {
      const rows = await post('chat/findContacts', {
        where: { remoteJid: `${variant}@s.whatsapp.net` },
      }).catch(() => null);
      const row = (Array.isArray(rows) ? rows[0] : null) as {
        pushName?: string;
        profilePicUrl?: string;
      } | null;
      pushName ??= row?.pushName || undefined;
      picture ??= row?.profilePicUrl || undefined;
      if (pushName && picture) break;
    }

    // Foto ausente no cadastro: pergunta ao WhatsApp. Perfil privado devolve vazio — não é erro.
    if (!picture) {
      const body = (await post('chat/fetchProfilePictureUrl', {
        number: phone,
      }).catch(() => null)) as { profilePictureUrl?: string | null } | null;
      picture = body?.profilePictureUrl || undefined;
    }

    return pushName || picture
      ? { pushName, profilePictureUrl: picture }
      : null;
  }

  /** A Evolution decifra e devolve a mídia em base64; mensagem recebida reenvia o payload gravado. */
  private async _downloadMedia(
    cfg: EvolutionApiConfig,
    lookup: MediaLookup,
  ): Promise<DownloadedMedia> {
    const stored = lookup.raw as { key?: unknown; message?: unknown } | null;
    const message =
      stored?.key && stored.message
        ? stored
        : { key: { id: lookup.providerMessageId, fromMe: lookup.fromMe } };

    const body = (await requestJson(
      'Evolution API',
      `${this.baseUrl(cfg)}/chat/getBase64FromMediaMessage/${encodeURIComponent(cfg.instance)}`,
      {
        method: 'POST',
        headers: this.headers(cfg),
        body: JSON.stringify({ message, convertToMp4: false }),
      },
      PROVIDER_TRANSFER_TIMEOUT_MS,
    )) as { base64?: string; mimetype?: string; fileName?: string } | null;

    if (!body?.base64) throw new Error('Evolution API não devolveu a mídia');
    return {
      data: Buffer.from(body.base64.replace(DATA_URL_PREFIX, ''), 'base64'),
      mimeType: body.mimetype ?? 'application/octet-stream',
      fileName: body.fileName,
    };
  }

  /** `POST /chat/sendPresence`: `delay` é obrigatório no schema da Evolution e controla quando ela mesma envia "paused". */
  private async _sendPresence(
    cfg: EvolutionApiConfig,
    phone: string,
    state: MessagingPresenceState,
  ): Promise<void> {
    const presence =
      state === 'PAUSED'
        ? 'paused'
        : state === 'RECORDING'
          ? 'recording'
          : 'composing';
    await requestJson(
      'Evolution API',
      `${this.baseUrl(cfg)}/chat/sendPresence/${encodeURIComponent(cfg.instance)}`,
      {
        method: 'POST',
        headers: this.headers(cfg),
        body: JSON.stringify({
          number: normalizePhone(phone),
          presence,
          delay: PRESENCE_DELAY_MS,
        }),
      },
    );
  }

  /** `TEMPLATE` degrada para texto interpolado — WhatsApp Web não tem catálogo aprovado nem janela de 24h. */
  private buildSend(input: SendMessageInput): {
    path: string;
    payload: Record<string, unknown>;
  } {
    const number = normalizePhone(input.phone);

    switch (input.type) {
      case MessagingMessageTypeConst.TEXT:
        return {
          path: 'message/sendText',
          payload: { number, text: input.text },
        };

      case MessagingMessageTypeConst.TEMPLATE:
        return {
          path: 'message/sendText',
          payload: { number, text: flattenTemplate(input.template).text },
        };

      case MessagingMessageTypeConst.AUDIO:
        // Áudio tem rota própria na v2; não vai pelo sendMedia.
        return {
          path: 'message/sendWhatsAppAudio',
          payload: { number, audio: mediaSource(input) },
        };

      case MessagingMessageTypeConst.IMAGE:
      case MessagingMessageTypeConst.VIDEO:
        return {
          path: 'message/sendMedia',
          payload: {
            number,
            mediatype: input.type.toLowerCase(),
            mimetype: input.file?.mimeType,
            media: mediaSource(input),
            fileName: `${input.type.toLowerCase()}.${extensionFromMime(input.file?.mimeType)}`,
            caption: input.caption,
          },
        };

      case MessagingMessageTypeConst.DOCUMENT:
        return {
          path: 'message/sendMedia',
          payload: {
            number,
            mediatype: 'document',
            mimetype: input.file?.mimeType,
            media: mediaSource(input),
            fileName: input.fileName,
            caption: input.caption,
          },
        };

      default:
        throw new UnsupportedMessageTypeError(
          MessagingProviderConst.EVOLUTION_API,
          (input as { type: string }).type,
        );
    }
  }

  private async _validate(cfg: EvolutionApiConfig): Promise<ProviderResult> {
    try {
      const res = await providerFetch(
        `${this.baseUrl(cfg)}/instance/connectionState/${encodeURIComponent(cfg.instance)}`,
        { headers: this.headers(cfg) },
      );

      // 404 aqui é bug conhecido de algumas instalações v2.3.6 (issue #2216), não credencial ruim.
      if (res.status === 404) {
        const probe = await providerFetch(
          `${this.baseUrl(cfg)}/instance/fetchInstances`,
          { headers: this.headers(cfg) },
        );
        return probe.ok
          ? {
              status: true,
              data: 'Credencial válida; estado da instância indisponível',
            }
          : {
              status: false,
              data: `Instância "${cfg.instance}" não encontrada`,
            };
      }

      const body = await readJson(res);
      if (!res.ok) return resultFromResponse(res, body, '');

      const state = (body as { instance?: { state?: string } } | null)?.instance
        ?.state;
      return { status: true, data: state ?? 'unknown' };
    } catch (error) {
      return failureResult(error);
    }
  }

  /** Cria a instância se ainda não existir e devolve o QR. Idempotente. */
  private async _connect(cfg: EvolutionApiConfig): Promise<MessagingSession> {
    const current = await this._sessionStatus(cfg);
    if (current.status === 'CONNECTED') return current;

    if (current.status === 'NOT_CREATED') {
      const created = await this.createInstance(cfg);
      if (created.session.qrCode) return created.session;
    }

    const body = await requestJson(
      'Evolution API',
      `${this.baseUrl(cfg)}/instance/connect/${encodeURIComponent(cfg.instance)}`,
      { headers: this.headers(cfg) },
    );
    return this.toSession(body, 'CONNECTING');
  }

  /** `ok: false` quando a Evolution recusou (p.ex. o nome já existe lá); o QR então vem do /instance/connect. */
  private async createInstance(
    cfg: EvolutionApiConfig,
  ): Promise<{ ok: boolean; session: MessagingSession; error?: string }> {
    const res = await providerFetch(`${this.baseUrl(cfg)}/instance/create`, {
      method: 'POST',
      headers: this.headers(cfg),
      body: JSON.stringify({
        instanceName: cfg.instance,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
      }),
    });
    const body = await readJson(res);
    return {
      ok: res.ok,
      session: this.toSession(body, 'CONNECTING'),
      error: res.ok ? undefined : (providerErrorText(body) ?? res.statusText),
    };
  }

  /** Garante a instância do sistema na Evolution; o nome (UUID) é nosso, criar nunca colide. */
  private async ensureInstance(cfg: EvolutionApiConfig): Promise<void> {
    if ((await this._sessionStatus(cfg)).status !== 'NOT_CREATED') return;
    const created = await this.createInstance(cfg);
    if (!created.ok) {
      throw new Error(`Evolution API não criou a instância: ${created.error}`);
    }
  }

  /** Existência e estado numa chamada só (`fetchInstances`); `connectionState` é só fallback. */
  private async _sessionStatus(
    cfg: EvolutionApiConfig,
  ): Promise<MessagingSession> {
    const listed = await providerFetch(
      `${this.baseUrl(cfg)}/instance/fetchInstances?instanceName=${encodeURIComponent(cfg.instance)}`,
      { headers: this.headers(cfg) },
    );
    if (listed.ok) {
      const body = await readJson(listed);
      if (Array.isArray(body)) return this.fromInstanceList(body, cfg.instance);
    }
    return this.fromConnectionState(cfg);
  }

  /** Aceita o formato da v2.3 (`name`/`connectionStatus`/`ownerJid`) e o das v2 antigas (`instance.instanceName`). */
  private fromInstanceList(list: unknown[], name: string): MessagingSession {
    const found = (list as EvolutionInstanceRow[]).find(
      (row) => (row.name ?? row.instance?.instanceName) === name,
    );
    if (!found) return { status: 'NOT_CREATED' };

    const owner = found.ownerJid ?? found.instance?.owner;
    return {
      status: mapConnectionState(
        found.connectionStatus ?? found.instance?.status,
      ),
      ...(owner ? { phoneNumber: normalizePhone(owner) } : {}),
    };
  }

  private async fromConnectionState(
    cfg: EvolutionApiConfig,
  ): Promise<MessagingSession> {
    const res = await providerFetch(
      `${this.baseUrl(cfg)}/instance/connectionState/${encodeURIComponent(cfg.instance)}`,
      { headers: this.headers(cfg) },
    );
    if (res.status === 404) return { status: 'NOT_CREATED' };
    if (!res.ok) return { status: 'DISCONNECTED' };

    const state = (
      (await readJson(res)) as {
        instance?: { state?: string };
      } | null
    )?.instance?.state;
    return { status: mapConnectionState(state) };
  }

  private async _disconnect(cfg: EvolutionApiConfig): Promise<ProviderResult> {
    try {
      const res = await providerFetch(
        `${this.baseUrl(cfg)}/instance/logout/${encodeURIComponent(cfg.instance)}`,
        { method: 'DELETE', headers: this.headers(cfg) },
      );
      if (res.status === 404 || res.status === 400) {
        return { status: true, data: 'Sessão encerrada' };
      }
      return resultFromResponse(res, await readJson(res), 'Sessão encerrada');
    } catch (error) {
      return failureResult(error);
    }
  }

  private toSession(
    body: unknown,
    fallback: MessagingSessionStatus,
  ): MessagingSession {
    const parsed = body as {
      qrcode?: { base64?: string; pairingCode?: string };
      base64?: string;
      pairingCode?: string;
      instance?: { state?: string; status?: string };
    } | null;

    const state = parsed?.instance?.state ?? parsed?.instance?.status;
    return {
      status: state === 'open' ? 'CONNECTED' : fallback,
      qrCode: parsed?.qrcode?.base64 ?? parsed?.base64,
      pairingCode: parsed?.qrcode?.pairingCode ?? parsed?.pairingCode,
    };
  }

  /** Camada nativa: confere o Bearer que nós mesmos registramos no webhook. */
  private _verifyWebhook(
    cfg: EvolutionApiConfig,
    req: WebhookRequest,
  ): boolean {
    if (!cfg.webhookSecret) return true;
    const header = req.headers['authorization'] ?? '';
    const expected = `Bearer ${cfg.webhookSecret}`;
    return timingSafeCompare(header, expected);
  }

  private _parseWebhook(
    cfg: EvolutionApiConfig,
    body: unknown,
  ): MessagingEvent[] {
    const payload = body as {
      event?: string;
      instance?: string;
      data?: Record<string, unknown>;
    } | null;
    const data = payload?.data;
    if (!data) return [];
    // Uma Evolution atende várias instâncias e todas podem apontar para esta URL: evento de
    // outra instância não é nosso — nem mensagem, nem conexão.
    if (
      typeof payload?.instance === 'string' &&
      payload.instance !== cfg.instance
    ) {
      return [];
    }

    switch (payload?.event?.toLowerCase()) {
      case 'messages.upsert':
        return this.parseMessage(data);
      case 'messages.update':
        return this.parseStatus(data);
      case 'connection.update':
        return this.parseConnection(data);
      case 'qrcode.updated':
        return this.parseQrCode(data);
      case 'contacts.upsert':
      case 'contacts.update':
        return this.parseContacts(data);
      case 'presence.update':
        return this.parsePresence(data);
      default:
        return [];
    }
  }

  /** Repasse direto do Baileys: `{ id, presences: { [participante]: { lastKnownPresence } } }`. */
  private parsePresence(data: Record<string, unknown>): MessagingEvent[] {
    const phone = firstPhoneJid(asText(data.id));
    if (!phone) return [];

    const presences =
      (data.presences as Record<string, { lastKnownPresence?: string }>) ?? {};
    const state = asText(
      Object.values(presences)[0]?.lastKnownPresence,
    ).toLowerCase();
    if (state === 'paused')
      return [{ kind: 'PRESENCE', phone, state: 'PAUSED' }];
    if (state === 'composing')
      return [{ kind: 'PRESENCE', phone, state: 'COMPOSING' }];
    if (state === 'recording')
      return [{ kind: 'PRESENCE', phone, state: 'RECORDING' }];
    return [];
  }

  /** `data` é uma lista (ou um item). Só nomes e fotos — o contato em si só é criado por mensagem. */
  private parseContacts(data: unknown): MessagingEvent[] {
    const rows = (Array.isArray(data) ? data : [data]) as Array<{
      remoteJid?: string;
      id?: string;
      pushName?: string;
      profilePicUrl?: string;
    }>;
    return rows.flatMap((row): MessagingEvent[] => {
      const jid = row.remoteJid ?? row.id;
      // Grupo e `@lid` (id opaco) não são telefone; guardá-los criaria contato fantasma.
      if (!jid?.endsWith('@s.whatsapp.net')) return [];
      if (!row.pushName && !row.profilePicUrl) return [];
      return [
        {
          kind: 'CONTACT',
          phone: normalizePhone(jid),
          pushName: row.pushName || undefined,
          profilePictureUrl: row.profilePicUrl || undefined,
        },
      ];
    });
  }

  private parseConnection(data: Record<string, unknown>): MessagingEvent[] {
    const state = asText(data.state);
    return state
      ? [{ kind: 'CONNECTION', status: mapConnectionState(state) }]
      : [];
  }

  private parseQrCode(data: Record<string, unknown>): MessagingEvent[] {
    const qr = data.qrcode as
      { base64?: string; pairingCode?: string } | undefined;
    const qrCode = qr?.base64 ?? (data.base64 as string | undefined);
    if (!qrCode) return [];
    return [
      {
        kind: 'CONNECTION',
        status: 'CONNECTING',
        qrCode,
        pairingCode:
          qr?.pairingCode ?? (data.pairingCode as string | undefined),
      },
    ];
  }

  private parseMessage(data: Record<string, unknown>): MessagingEvent[] {
    const key = data.key as
      | {
          id?: string;
          remoteJid?: string;
          remoteJidAlt?: string;
          participantAlt?: string;
          fromMe?: boolean;
        }
      | undefined;
    if (!key?.id || !key.remoteJid) return [];
    // Grupo, status (`status@broadcast`) e canal não são conversa com uma pessoa.
    // `@lid` só vale se o provider mandou o JID de telefone ao lado; senão não há número a usar.
    const phone = firstPhoneJid(key.remoteJid, key.remoteJidAlt);
    if (!phone) return [];

    const parsed = parseBaileysMessage(
      data.message as Record<string, unknown> | undefined,
    );
    if (!parsed) return [];

    return [
      {
        kind: 'MESSAGE',
        providerMessageId: key.id,
        phone,
        pushName: key.fromMe ? undefined : asText(data.pushName) || undefined,
        fromMe: key.fromMe === true,
        ...parsed,
        at: toDate(data.messageTimestamp),
        raw: data,
      },
    ];
  }

  private parseStatus(data: Record<string, unknown>): MessagingEvent[] {
    const key = data.key as { id?: string } | undefined;
    const status = EVOLUTION_STATUS[asText(data.status).toUpperCase()];
    if (!key?.id || !status) return [];
    return [
      {
        kind: 'STATUS',
        providerMessageId: key.id,
        status,
        at: toDate(data.messageTimestamp),
      },
    ];
  }

  private async _registerWebhook(
    cfg: EvolutionApiConfig,
    url: string,
  ): Promise<ProviderResult> {
    try {
      // Registrar o webhook é o momento de ligar o sistema à instância: ela precisa existir.
      await this.ensureInstance(cfg);
      const res = await providerFetch(
        `${this.baseUrl(cfg)}/webhook/set/${encodeURIComponent(cfg.instance)}`,
        {
          method: 'POST',
          headers: this.headers(cfg),
          body: JSON.stringify({
            webhook: {
              enabled: true,
              url,
              // Uma URL para todos os eventos: `byEvents` quebraria em /webhook/messages-upsert
              // etc. e exigiria uma rota de proxy por evento no front.
              byEvents: false,
              // Sem base64: o webhook só avisa. A mídia é buscada sob demanda (`downloadMedia`).
              base64: false,
              ...(cfg.webhookSecret
                ? { headers: { authorization: `Bearer ${cfg.webhookSecret}` } }
                : {}),
              // CONNECTION_UPDATE/QRCODE_UPDATED trazem o estado da sessão por push, sem polling.
              events: [
                'MESSAGES_UPSERT',
                'MESSAGES_UPDATE',
                'CONNECTION_UPDATE',
                'QRCODE_UPDATED',
                // Nome e foto chegam por push, sem consultar contato a contato.
                'CONTACTS_UPSERT',
                'CONTACTS_UPDATE',
              ],
            },
          }),
        },
      );
      return resultFromResponse(res, await readJson(res), url);
    } catch (error) {
      return failureResult(error);
    }
  }

  private async _unregisterWebhook(
    cfg: EvolutionApiConfig,
  ): Promise<ProviderResult> {
    try {
      const url = `${this.baseUrl(cfg)}/webhook/find/${encodeURIComponent(cfg.instance)}`;
      const currentResponse = await providerFetch(url, {
        method: 'GET',
        headers: this.headers(cfg),
      });
      const currentBody = await readJson(currentResponse);
      if (!currentResponse.ok) {
        return resultFromResponse(
          currentResponse,
          currentBody,
          'Configuração do webhook consultada',
        );
      }

      const settings = this.webhookSettings(currentBody);
      if (!settings || typeof settings.url !== 'string' || !settings.url) {
        return {
          status: false,
          data: 'Evolution API não retornou a URL atual do webhook; não foi possível desativá-lo com segurança',
        };
      }

      const res = await providerFetch(
        `${this.baseUrl(cfg)}/webhook/set/${encodeURIComponent(cfg.instance)}`,
        {
          method: 'POST',
          headers: this.headers(cfg),
          body: JSON.stringify({
            webhook: {
              ...settings,
              enabled: false,
            },
          }),
        },
      );
      const responseBody = await readJson(res);
      if (!res.ok) {
        return resultFromResponse(res, responseBody, 'Webhook desativado');
      }

      const verifyResponse = await providerFetch(url, {
        method: 'GET',
        headers: this.headers(cfg),
      });
      const verifyBody = await readJson(verifyResponse);
      if (!verifyResponse.ok) {
        return resultFromResponse(
          verifyResponse,
          verifyBody,
          'Estado do webhook verificado',
        );
      }
      const verifySettings = this.webhookSettings(verifyBody);
      if (!verifySettings || verifySettings.enabled !== false) {
        return {
          status: false,
          data: 'Evolution API aceitou a solicitação, mas o webhook continua habilitado',
        };
      }
      return { status: true, data: 'Webhook desativado e confirmado' };
    } catch (error) {
      return failureResult(error);
    }
  }

  private webhookSettings(body: unknown): Record<string, unknown> | null {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return null;

    const response = body as Record<string, unknown>;
    const nested = response.webhook;
    const settings =
      nested && typeof nested === 'object' && !Array.isArray(nested)
        ? (nested as Record<string, unknown>)
        : response;
    const url = settings.url ?? settings.webhookUrl;
    if (typeof url !== 'string' || !url) return null;

    return {
      url,
      ...(typeof settings.enabled === 'boolean'
        ? { enabled: settings.enabled }
        : {}),
      ...(settings.headers !== undefined ? { headers: settings.headers } : {}),
      ...(settings.events !== undefined ? { events: settings.events } : {}),
      ...(settings.byEvents !== undefined ||
      settings.webhookByEvents !== undefined ||
      settings.webhook_by_events !== undefined
        ? {
            byEvents:
              settings.byEvents ??
              settings.webhookByEvents ??
              settings.webhook_by_events,
          }
        : {}),
      ...(settings.base64 !== undefined ||
      settings.webhookBase64 !== undefined ||
      settings.webhook_base64 !== undefined
        ? {
            base64:
              settings.base64 ??
              settings.webhookBase64 ??
              settings.webhook_base64,
          }
        : {}),
    };
  }
}
