import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import type {
  DownloadedMedia,
  MediaFile,
  IMessagingProvider,
  IMessagingService,
  MediaLookup,
  MessagingCapabilities,
  MessagingPresenceState,
  MessagingSession,
  SendMessageInput,
  SendResult,
  MessagingEvent,
  WebhookRequest,
} from 'src/domain/interface/messaging-provider.interface';
import { UnsupportedMessageTypeError } from 'src/domain/interface/messaging-provider.interface';
import type { ProviderResult } from 'src/domain/interface/provider-result';
import {
  MESSAGING_MESSAGE_TYPES,
  MessagingMessageTypeConst,
  MessagingProviderConst,
} from 'src/domain/messaging/messaging.const';
import { firstPhoneJid, normalizePhone } from './phone.util';
import { DATA_URL_PREFIX, mimeFromDataUrl } from './media-url.util';
import {
  extensionFromMime,
  failureResult,
  PROVIDER_TRANSFER_TIMEOUT_MS,
  providerErrorText,
  providerFetch,
  uploadTimeoutMs,
  readJson,
  requestJson,
  resultFromResponse,
} from './provider-http.util';
import {
  asText,
  EVOLUTION_GO_STATUS,
  parseBaileysMessage,
  timingSafeCompare,
  toDate,
} from './webhook.util';
import { flattenTemplate } from './template.util';

/** `token` é a chave global (`GLOBAL_API_KEY`); `instanceId`/`instanceToken` são gerados pelo sistema. */
export const evolutionGoConfigSchema = z.object({
  baseUrl: z.string().url(),
  token: z.string().min(1),
  instanceId: z.string().min(1),
  instanceToken: z.string().min(1),
});
export type EvolutionGoConfig = z.infer<typeof evolutionGoConfigSchema>;

/** Modelo `Instance` do `GET /instance/info/:id` — `jid` e `qrcode` só existem aqui, não no `/status`. */
interface EvolutionGoInstance {
  jid?: string;
  qrcode?: string;
  connected?: boolean;
}

/** Extrai a data URI exibível do qrcode da instância, descartando o sufixo que o Go anexa. */
function dataUrlOf(qrcode: string | undefined): string | undefined {
  const dataUrl = qrcode?.split('|')[0];
  return dataUrl?.startsWith('data:') ? dataUrl : undefined;
}

/** Evolution Go (Go/whatsmeow). Provisionado pelo sistema, igual à Evolution API. */
@Injectable()
export class EvolutionGoProvider implements IMessagingService<EvolutionGoConfig> {
  readonly configSchema = evolutionGoConfigSchema;
  readonly configFields = [
    'baseUrl',
    'token',
    'instanceId',
    'instanceToken',
  ] as const;
  readonly secretFields = ['token', 'instanceToken'] as const;
  readonly messagingCapabilities: MessagingCapabilities = {
    messageTypes: MESSAGING_MESSAGE_TYPES,
    template: {
      approval: false,
      providerOwnedBody: [],
      components: { header: [], footer: false, buttons: [] },
    },
    voiceRecording: false,
    typing: { inbound: true, outbound: true },
    serviceWindowHours: null,
  };

  systemFields(previous?: Record<string, string>): Record<string, string> {
    return {
      instanceId: previous?.instanceId || randomUUID(),
      instanceToken: previous?.instanceToken || randomUUID(),
    };
  }

  use(cfg: EvolutionGoConfig): IMessagingProvider {
    return {
      session: {
        connect: () => this._connect(cfg),
        status: () => this._sessionStatus(cfg),
        disconnect: () => this._logout(cfg),
      },
      capabilities: () => this.messagingCapabilities,
      send: (input) => this._send(cfg, input),
      downloadMedia: (lookup) => this._downloadMedia(cfg, lookup),
      sendPresence: (phone, state) => this._sendPresence(cfg, phone, state),
      validateConfiguration: () => this._validate(cfg),
      verifyWebhook: (req) => this._verifyWebhook(cfg, req),
      parseWebhook: (body) => this._parseWebhook(body),
      registerWebhook: (url) => this._registerWebhook(cfg, url),
      unregisterWebhook: () => this._unregisterWebhook(cfg),
      deleteInstance: () => this._deleteInstance(cfg),
    };
  }

  private baseUrl(cfg: EvolutionGoConfig): string {
    return cfg.baseUrl.replace(/\/+$/, '');
  }

  /** Chave global: só as rotas de administração da instância (`/instance/info`, `/create`) aceitam. */
  private adminHeaders(cfg: EvolutionGoConfig): Record<string, string> {
    return { 'Content-Type': 'application/json', apikey: cfg.token };
  }

  /** Token da instância: envio, mídia e as rotas de sessão. */
  private headers(cfg: EvolutionGoConfig): Record<string, string> {
    return { 'Content-Type': 'application/json', apikey: cfg.instanceToken };
  }

  private async _send(
    cfg: EvolutionGoConfig,
    input: SendMessageInput,
  ): Promise<SendResult> {
    const { path, payload, file } = this.buildSend(input);

    const body = (await requestJson(
      'Evolution Go',
      `${this.baseUrl(cfg)}${path}`,
      {
        method: 'POST',
        ...(file
          ? this.multipart(cfg, payload, file)
          : { headers: this.headers(cfg), body: JSON.stringify(payload) }),
      },
      file ? uploadTimeoutMs(file.data.length) : undefined,
    )) as {
      messageId?: string;
      data?: { Info?: { ID?: string } };
    } | null;

    const id = body?.messageId ?? body?.data?.Info?.ID;
    if (!id) {
      throw new Error('Evolution Go aceitou o envio sem devolver messageId');
    }
    return { providerMessageId: id, acceptedAt: new Date() };
  }

  /** Upload: mesmo `/send/media`, em multipart. Sem `Content-Type` manual — o fetch precisa gerar o boundary. */
  private multipart(
    cfg: EvolutionGoConfig,
    payload: Record<string, string | undefined>,
    file: MediaFile,
  ): RequestInit {
    const form = new FormData();
    for (const [key, value] of Object.entries(payload)) {
      if (value !== undefined && key !== 'url') form.append(key, value);
    }
    form.append(
      'file',
      new Blob([new Uint8Array(file.data)], { type: file.mimeType }),
      payload.filename ?? `file.${extensionFromMime(file.mimeType)}`,
    );
    return { headers: { apikey: cfg.instanceToken }, body: form };
  }

  /** O Go devolve a mídia como data URL em `data.base64`, sem campo de mimetype — o tipo vem do prefixo. */
  private async _downloadMedia(
    cfg: EvolutionGoConfig,
    lookup: MediaLookup,
  ): Promise<DownloadedMedia> {
    const stored = lookup.raw as { Message?: unknown } | null;
    if (!stored?.Message) {
      throw new Error('Evolution Go: mensagem sem payload para baixar a mídia');
    }

    const body = (await requestJson(
      'Evolution Go',
      `${this.baseUrl(cfg)}/message/downloadmedia`,
      {
        method: 'POST',
        headers: this.headers(cfg),
        body: JSON.stringify({ message: stored.Message }),
      },
      PROVIDER_TRANSFER_TIMEOUT_MS,
    )) as {
      base64?: string;
      mimetype?: string;
      data?: { base64?: string; mimetype?: string };
    } | null;

    const base64 = body?.data?.base64 ?? body?.base64;
    if (!base64) throw new Error('Evolution Go não devolveu a mídia');
    return {
      data: Buffer.from(base64.replace(DATA_URL_PREFIX, ''), 'base64'),
      mimeType:
        mimeFromDataUrl(base64) ??
        body?.data?.mimetype ??
        body?.mimetype ??
        'application/octet-stream',
    };
  }

  /** `POST /message/presence`: `isAudio` é o sinal de "gravando" — o Go não tem um terceiro estado. */
  private async _sendPresence(
    cfg: EvolutionGoConfig,
    phone: string,
    state: MessagingPresenceState,
  ): Promise<void> {
    await requestJson('Evolution Go', `${this.baseUrl(cfg)}/message/presence`, {
      method: 'POST',
      headers: this.headers(cfg),
      body: JSON.stringify({
        number: normalizePhone(phone),
        state: state === 'PAUSED' ? 'paused' : 'composing',
        isAudio: state === 'RECORDING',
      }),
    });
  }

  /** Mídia vai por URL (o Go baixa) ou por upload multipart, e `TEMPLATE` degrada para texto como no irmão Node. */
  private buildSend(input: SendMessageInput): {
    path: string;
    payload: Record<string, string | undefined>;
    file?: MediaFile;
  } {
    const number = normalizePhone(input.phone);

    switch (input.type) {
      case MessagingMessageTypeConst.TEXT:
        return { path: '/send/text', payload: { number, text: input.text } };

      case MessagingMessageTypeConst.TEMPLATE:
        return {
          path: '/send/text',
          payload: { number, text: flattenTemplate(input.template).text },
        };

      case MessagingMessageTypeConst.IMAGE:
      case MessagingMessageTypeConst.VIDEO:
      case MessagingMessageTypeConst.AUDIO:
        return {
          path: '/send/media',
          payload: {
            number,
            url: input.mediaUrl,
            type: input.type.toLowerCase(),
            caption: 'caption' in input ? input.caption : undefined,
          },
          file: input.file,
        };

      case MessagingMessageTypeConst.DOCUMENT:
        return {
          path: '/send/media',
          payload: {
            number,
            url: input.mediaUrl,
            type: 'document',
            filename: input.fileName,
            caption: input.caption,
          },
          file: input.file,
        };

      default:
        throw new UnsupportedMessageTypeError(
          MessagingProviderConst.EVOLUTION_GO,
          (input as { type: string }).type,
        );
    }
  }

  /** Garante a instância e afirma o pareamento: pedir para conectar já é o sinal de que estamos pareando. */
  private async _connect(cfg: EvolutionGoConfig): Promise<MessagingSession> {
    await this.ensureInstance(cfg);
    const status = await this._sessionStatus(cfg);
    return status.status === 'CONNECTED'
      ? status
      : { ...status, status: 'CONNECTING' };
  }

  /** Instância ausente: `404` ou o `record not found` que o Go devolve cru do GORM, em outro status. */
  private isMissingInstance(res: Response, body: unknown): boolean {
    if (res.status === 404) return true;
    return !res.ok && /record not found/i.test(providerErrorText(body) ?? '');
  }

  /** Lê `GET /instance/info/:id` sob a chave global e devolve a resposta com o corpo já parseado. */
  private async fetchInstance(
    cfg: EvolutionGoConfig,
  ): Promise<{ res: Response; body: unknown }> {
    const res = await providerFetch(
      `${this.baseUrl(cfg)}/instance/info/${encodeURIComponent(cfg.instanceId)}`,
      { headers: this.adminHeaders(cfg) },
    );
    return { res, body: await readJson(res) };
  }

  /** Instância ausente é criada por `POST /instance/create`; as duas chamadas sob a chave global. */
  private async ensureInstance(cfg: EvolutionGoConfig): Promise<void> {
    const probe = await this.fetchInstance(cfg);
    if (!this.isMissingInstance(probe.res, probe.body)) return;

    const res = await providerFetch(`${this.baseUrl(cfg)}/instance/create`, {
      method: 'POST',
      headers: this.adminHeaders(cfg),
      body: JSON.stringify({
        instanceId: cfg.instanceId,
        name: cfg.instanceId,
        token: cfg.instanceToken,
        // Grupo nunca chega: resolve na origem o bug de receipt de grupo envenenando o lote.
        advancedSettings: { ignoreGroups: true, ignoreStatus: true },
      }),
    });
    if (!res.ok) {
      const body = await readJson(res);
      throw new Error(
        `Evolution Go não criou a instância: ${providerErrorText(body) ?? res.statusText}`,
      );
    }
  }

  /** `GET /instance/info/:id` (chave global): uma chamada só traz existência, número e QR persistidos. */
  private async _sessionStatus(
    cfg: EvolutionGoConfig,
  ): Promise<MessagingSession> {
    const { res, body } = await this.fetchInstance(cfg);
    if (this.isMissingInstance(res, body)) return { status: 'NOT_CREATED' };

    if (!res.ok) {
      throw new Error(
        `Evolution Go ${res.status}: ${providerErrorText(body) ?? res.statusText}`,
      );
    }
    return this.fromInstanceInfo(body);
  }

  /** Pareamento confirmado exige `connected` e `jid` juntos: o `jid` só existe depois do QR lido. */
  private fromInstanceInfo(body: unknown): MessagingSession {
    const data = (body as { data?: EvolutionGoInstance } | null)?.data ?? {};
    const phoneNumber = firstPhoneJid(data.jid);
    const connected = Boolean(data.connected && data.jid);
    const qrCode = dataUrlOf(data.qrcode);
    return {
      status: connected
        ? 'CONNECTED'
        : data.qrcode
          ? 'CONNECTING'
          : 'DISCONNECTED',
      ...(phoneNumber ? { phoneNumber } : {}),
      ...(qrCode && !connected ? { qrCode } : {}),
    };
  }

  /** Despareia de verdade (`client.Logout()`), igual ao Evolution API. */
  private async _logout(cfg: EvolutionGoConfig): Promise<ProviderResult> {
    try {
      const res = await providerFetch(`${this.baseUrl(cfg)}/instance/logout`, {
        method: 'DELETE',
        headers: this.headers(cfg),
      });
      if (res.status === 404 || res.status === 400) {
        return { status: true, data: 'Sessão encerrada' };
      }
      return resultFromResponse(res, await readJson(res), 'Sessão encerrada');
    } catch (error) {
      return failureResult(error);
    }
  }

  /** Instância ausente já prova a chave global: a rota foi alcançada e autenticada. */
  private async _validate(cfg: EvolutionGoConfig): Promise<ProviderResult> {
    try {
      const { res, body } = await this.fetchInstance(cfg);
      if (this.isMissingInstance(res, body)) {
        return {
          status: true,
          data: 'Chave válida; instância ainda não criada',
        };
      }

      if (!res.ok) return resultFromResponse(res, body, '');

      const data = (body as { data?: EvolutionGoInstance } | null)?.data;
      return { status: true, data: `connected=${data?.connected ?? false}` };
    } catch (error) {
      return failureResult(error);
    }
  }

  /** `DELETE /instance/delete/:id` sob a chave global, igual à criação. */
  private async _deleteInstance(
    cfg: EvolutionGoConfig,
  ): Promise<ProviderResult> {
    try {
      const res = await providerFetch(
        `${this.baseUrl(cfg)}/instance/delete/${encodeURIComponent(cfg.instanceId)}`,
        { method: 'DELETE', headers: this.adminHeaders(cfg) },
      );
      return resultFromResponse(res, await readJson(res), 'Instância apagada');
    } catch (error) {
      return failureResult(error);
    }
  }

  /** `/instance/disconnect` limpa as assinaturas de eventos da instância no Evolution Go. */
  private async _unregisterWebhook(
    cfg: EvolutionGoConfig,
  ): Promise<ProviderResult> {
    try {
      const res = await providerFetch(
        `${this.baseUrl(cfg)}/instance/disconnect`,
        { method: 'POST', headers: this.headers(cfg) },
      );
      return resultFromResponse(res, await readJson(res), 'Webhook desativado');
    } catch (error) {
      return failureResult(error);
    }
  }

  /** O Go não assina nem aceita header custom: manda `instanceToken` no corpo. */
  private _verifyWebhook(cfg: EvolutionGoConfig, req: WebhookRequest): boolean {
    if (!cfg.instanceToken) return true;
    try {
      const body = JSON.parse(req.raw.toString('utf8')) as {
        instanceToken?: string;
      };
      return timingSafeCompare(body?.instanceToken ?? '', cfg.instanceToken);
    } catch {
      return false;
    }
  }

  private _parseWebhook(body: unknown): MessagingEvent[] {
    const payload = body as {
      event?: string;
      state?: string;
      data?: Record<string, unknown>;
    } | null;
    const event = payload?.event?.toLowerCase();
    if (!payload?.data) return [];

    if (event === 'message') return this.parseMessage(payload.data);
    if (event === 'receipt') {
      return this.parseReceipt(payload.data, asText(payload.state));
    }
    if (event === 'chatpresence') return this.parsePresence(payload.data);
    return this.parseConnection(event, payload.data);
  }

  /** `events.ChatPresence` do whatsmeow, achatado: `Chat`/`State` (composing/paused) + `Media` (audio = nota de voz). */
  private parsePresence(data: Record<string, unknown>): MessagingEvent[] {
    const info = data as {
      Chat?: string;
      SenderAlt?: string;
      RecipientAlt?: string;
      IsFromMe?: boolean;
      IsGroup?: boolean;
      State?: string;
      Media?: string;
    };
    if (info.IsGroup) return [];
    const phone = firstPhoneJid(
      info.Chat,
      info.IsFromMe ? info.RecipientAlt : info.SenderAlt,
    );
    if (!phone) return [];

    const state = asText(info.State).toLowerCase();
    if (state === 'paused')
      return [{ kind: 'PRESENCE', phone, state: 'PAUSED' }];
    if (state !== 'composing') return [];
    return [
      {
        kind: 'PRESENCE',
        phone,
        state:
          asText(info.Media).toLowerCase() === 'audio'
            ? 'RECORDING'
            : 'COMPOSING',
      },
    ];
  }

  private parseMessage(data: Record<string, unknown>): MessagingEvent[] {
    const info = data.Info as
      | {
          ID?: string;
          Chat?: string;
          SenderAlt?: string;
          RecipientAlt?: string;
          IsFromMe?: boolean;
          IsGroup?: boolean;
          PushName?: string;
          Timestamp?: string;
        }
      | undefined;
    if (!info?.ID || !info.Chat) return [];
    // `IsGroup` vem do whatsmeow e é a fonte certa; o sufixo do JID ainda filtra status e canal.
    if (info.IsGroup) return [];
    // `@lid` só vale com o JID de telefone ao lado — `RecipientAlt` quando a mensagem é nossa.
    const phone = firstPhoneJid(
      info.Chat,
      info.IsFromMe ? info.RecipientAlt : info.SenderAlt,
    );
    if (!phone) return [];

    const parsed = parseBaileysMessage(
      data.Message as Record<string, unknown> | undefined,
    );
    if (!parsed) return [];

    return [
      {
        kind: 'MESSAGE',
        providerMessageId: info.ID,
        phone,
        pushName: info.IsFromMe ? undefined : info.PushName || undefined,
        fromMe: info.IsFromMe === true,
        ...parsed,
        at: toDate(info.Timestamp),
        raw: data,
      },
    ];
  }

  /** `Connected`/`PairSuccess` trazem o JID do aparelho — é daí que sai o número da conexão. */
  private parseConnection(
    event: string | undefined,
    data: Record<string, unknown>,
  ): MessagingEvent[] {
    switch (event) {
      case 'connected':
      case 'pairsuccess': {
        const phoneNumber = firstPhoneJid(asText(data.jid) || asText(data.ID));
        return [
          {
            kind: 'CONNECTION',
            status: 'CONNECTED',
            ...(phoneNumber ? { phoneNumber } : {}),
          },
        ];
      }
      // `qrtimeout` é o pior: o QR expirou e o Go já forçou logout — sem tratar, a tela ficava
      // presa mostrando um código morto.
      case 'loggedout':
      case 'disconnected':
      case 'connectfailure':
      case 'temporaryban':
      case 'qrtimeout':
        return [{ kind: 'CONNECTION', status: 'DISCONNECTED' }];
      case 'qrcode': {
        const qrCode = asText(data.qrcode);
        return qrCode
          ? [{ kind: 'CONNECTION', status: 'CONNECTING', qrCode }]
          : [];
      }
      // `qrsuccess` é o QR lido; quem confirma o pareamento e fixa o número é o evento seguinte.
      case 'qrsuccess':
        return [{ kind: 'CONNECTION', status: 'CONNECTING' }];
      default:
        return [];
    }
  }

  /** `MessageIDs` é array (N mensagens); o estado vem do `state` do envelope, não de `data.Type`. */
  private parseReceipt(
    data: Record<string, unknown>,
    state: string,
  ): MessagingEvent[] {
    const ids = (data.MessageIDs as string[] | undefined) ?? [];
    const status =
      EVOLUTION_GO_STATUS[state.toLowerCase()] ??
      EVOLUTION_GO_STATUS[asText(data.Type).toLowerCase()];
    if (!status) return [];

    const at = toDate(data.Timestamp);
    return ids.filter(Boolean).map((id) => ({
      kind: 'STATUS' as const,
      providerMessageId: id,
      status,
      at,
    }));
  }

  /** Grava a URL do webhook, define as assinaturas e sobe o cliente — é o que inicia o pareamento. */
  private async _registerWebhook(
    cfg: EvolutionGoConfig,
    url: string,
  ): Promise<ProviderResult> {
    try {
      await this.ensureInstance(cfg);
      const res = await providerFetch(`${this.baseUrl(cfg)}/instance/connect`, {
        method: 'POST',
        headers: this.headers(cfg),
        body: JSON.stringify({
          webhookUrl: url,
          subscribe: ['ALL'],
          immediate: true,
        }),
      });
      return resultFromResponse(res, await readJson(res), url);
    } catch (error) {
      return failureResult(error);
    }
  }
}
