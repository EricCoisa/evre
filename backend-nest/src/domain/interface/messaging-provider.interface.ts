import type { z } from 'zod';
import type { ProviderResult } from 'src/domain/interface/provider-result';
import type {
  MessagingMessageType,
  MessagingStatus,
  MessagingStoredType,
  MessagingTemplateApproval,
  MessagingTemplateCategory,
} from 'src/domain/messaging/messaging.const';

/** Header do template: TEXT (renderizado como parâmetro nomeado) ou IMAGE (URL fornecida no envio). */
export type TemplateHeader =
  | { kind: 'TEXT'; text: string }
  | { kind: 'IMAGE'; url: string };

/** slot liga o botão a um espaço tipado do tipo de template; payload é o que a Meta devolve no toque. */
export type TemplateButton =
  | { kind: 'URL'; label: string; url: string; slot?: string }
  | { kind: 'QUICK_REPLY'; label: string; payload?: string; slot?: string }
  | { kind: 'PHONE_NUMBER'; label: string; phoneNumber: string; slot?: string }
  | { kind: 'COPY_CODE'; label: string; payload?: string; slot?: string };

/** Template já resolvido do banco e renderizado: o adapter não conhece as nossas tabelas. */
export interface ResolvedTemplate {
  /** Nome no catálogo do provider (snake_case do key). */
  name: string;
  language: string;
  category: MessagingTemplateCategory;
  /** Já formatados — ver docs/backend/messaging.md. */
  values: Record<string, string>;
  /** Corpo já renderizado (usado pelo achatamento). */
  body: string;
  /** Corpo como cadastrado, com os {{ variáveis }}; ausente usa o body já renderizado. */
  bodySource?: string;
  header?: TemplateHeader;
  footer?: string;
  buttons?: TemplateButton[];
  /** Presente só quando o template tem variável sensitive: versão com os valores mascarados para o histórico. */
  redacted?: {
    body: string;
    values: Record<string, string>;
    /** Nomes mascarados — fica no `raw` gravado para o dispatch saber que a linha é redigida. */
    names: string[];
  };
}

/** Definição crua do template (placeholders intactos) — o que a submissão manda criar/editar na WABA. */
export interface TemplateDefinition {
  name: string;
  language: string;
  category: MessagingTemplateCategory;
  header?: TemplateHeader;
  body: string;
  footer?: string;
  buttons?: TemplateButton[];
  /** Valor de exemplo por variável, exigido pela Meta para toda submissão (inclusive revisão). */
  examples: Record<string, string>;
}

/** Status de um template no catálogo remoto, como a reconciliação ou o webhook o devolvem. */
export interface RemoteTemplateStatus {
  providerTemplateId: string;
  name: string;
  language: string;
  status: MessagingTemplateApproval;
  reason?: string;
  /** Categoria que a Meta atribuiu; ausente quando o provider não informa. */
  category?: 'AUTHENTICATION' | 'UTILITY' | 'MARKETING';
  /** Componentes estruturais do template devolvidos pela Meta (HEADER, BODY, FOOTER, BUTTONS) */
  components?: unknown[];
}

/** `template_category_update` da WABA — a Meta reclassificou o template. */
export interface RemoteTemplateCategoryChange {
  providerTemplateId: string;
  name: string;
  language: string;
  previousCategory?: 'AUTHENTICATION' | 'UTILITY' | 'MARKETING';
  newCategory: 'AUTHENTICATION' | 'UTILITY' | 'MARKETING';
}

/** Arquivo enviado pelo operador. Atravessa o backend em memória, direto para o provider — nunca vai a storage. */
export interface MediaFile {
  data: Buffer;
  mimeType: string;
}

/** Mídia de saída: ou uma URL que o provider baixa (`mediaUrl`) ou o arquivo em si (`file`). Exatamente um. */
interface OutboundMedia {
  mediaUrl?: string;
  file?: MediaFile;
}

export type SendMessageInput = { phone: string } & (
  | { type: Extract<MessagingMessageType, 'TEXT'>; text: string }
  | ({
      type: Extract<MessagingMessageType, 'IMAGE' | 'VIDEO'>;
      caption?: string;
    } & OutboundMedia)
  | ({
      type: Extract<MessagingMessageType, 'DOCUMENT'>;
      fileName: string;
      caption?: string;
    } & OutboundMedia)
  | ({ type: Extract<MessagingMessageType, 'AUDIO'> } & OutboundMedia)
  | {
      type: Extract<MessagingMessageType, 'TEMPLATE'>;
      template: ResolvedTemplate;
    }
);

/** Quebra o build se `MESSAGING_MESSAGE_TYPES` ganhar/perder um tipo e este union não acompanhar. */
type _AssertSendMessageInputCoversAllTypes =
  MessagingMessageType extends SendMessageInput['type'] ? true : never;

const _assertSendMessageInputCoversAllTypes: _AssertSendMessageInputCoversAllTypes = true;

export interface MessagingCapabilities {
  messageTypes: readonly MessagingMessageType[];
  template: {
    /** O provider tem fluxo de aprovação (Meta) — sem ele, qualquer template cadastrado já envia. */
    approval: boolean;
    /** Categorias cujo corpo é escrito pelo provider; a Meta ignora o nosso `body` nelas (AUTHENTICATION). */
    providerOwnedBody: readonly MessagingTemplateCategory[];
    /** Componentes nativos suportados; vazio = achatamento em texto (ver `flattenTemplate`). */
    components: {
      header: readonly ('TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT')[];
      footer: boolean;
      buttons: readonly (
        'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'COPY_CODE'
      )[];
    };
  };
  /** Aceita o áudio gravado pelo navegador (WebM/Opus); a Meta não, e ali o operador anexa arquivo. */
  voiceRecording: boolean;
  /** Direções independentes: um provider pode avisar que o contato digita sem aceitar avisar o contrário. */
  typing: { inbound: boolean; outbound: boolean };
  /** Janela de atendimento em horas após a última mensagem recebida; fora dela só template. */
  serviceWindowHours: number | null;
}

/** Estado de digitação, no vocabulário da tela — cada adapter traduz o dele para este. */
export type MessagingPresenceState = 'COMPOSING' | 'RECORDING' | 'PAUSED';

/** O provider aceitou — não significa que o destinatário recebeu ou leu. */
export type SendResult = {
  providerMessageId: string;
  acceptedAt: Date;
  /** Referência da mídia no provider quando ele a exige para baixá-la depois (Meta, após upload). */
  mediaRef?: string;
};

/** Mídia devolvida pelo provider; cabe em memória (limites do WhatsApp) e é repassada ao cliente sem gravar. */
export interface DownloadedMedia {
  data: Buffer;
  mimeType: string;
  fileName?: string;
}

/** O que o provider precisa para localizar a mídia de uma mensagem já registrada. */
export interface MediaLookup {
  providerMessageId: string;
  fromMe: boolean;
  /** Payload gravado no recebimento (`MessagingMessage.raw`); no outbound, o que enviamos + `mediaRef`. */
  raw: unknown;
}

/** Evento já normalizado, saído do webhook de qualquer provider. */
export type MessagingEvent =
  | {
      kind: 'MESSAGE';
      providerMessageId: string;
      phone: string;
      pushName?: string;
      type: MessagingStoredType;
      /** `true` = enviada pelo próprio número em outro dispositivo (celular); vira OUTBOUND. */
      fromMe: boolean;
      text?: string;
      mimeType?: string;
      fileName?: string;
      /** Id (no provider) da mensagem que esta responde — `context.id` da Meta. */
      replyTo?: string;
      /** Payload/id do botão tocado (resposta rápida de template ou botão interativo). */
      buttonPayload?: string;
      at: Date;
      raw: unknown;
    }
  | {
      kind: 'STATUS';
      providerMessageId: string;
      status: MessagingStatus;
      at: Date;
    }
  | {
      /** O provider informou nome ou foto de um contato (contacts.upsert/update). */
      kind: 'CONTACT';
      phone: string;
      pushName?: string;
      profilePictureUrl?: string;
    }
  | {
      /** A conexão da instância mudou (pareou, caiu, QR novo). Push do provider, sem polling. */
      kind: 'CONNECTION';
      status: MessagingSessionStatus;
      qrCode?: string;
      pairingCode?: string;
      /** Número da sessão, quando o evento o traz (ex.: JID do `Connected` do Evolution Go). */
      phoneNumber?: string;
    }
  | {
      /** O contato está digitando ou gravando áudio. Efêmero: não entra na fila nem é gravado. */
      kind: 'PRESENCE';
      phone: string;
      state: MessagingPresenceState;
    }
  | ({
      /** `message_template_status_update` da WABA — aprovação, reprovação ou pausa por qualidade. */
      kind: 'TEMPLATE_STATUS';
    } & RemoteTemplateStatus)
  | ({ kind: 'TEMPLATE_CATEGORY' } & RemoteTemplateCategoryChange);

/** Nome e foto do contato no WhatsApp, como o provider os conhece. */
export interface ContactProfile {
  /** Nome que o contato definiu no WhatsApp. */
  pushName?: string;
  /** URL assinada e de vida curta do CDN do WhatsApp. */
  profilePictureUrl?: string;
}

export interface WebhookRequest {
  /** Corpo cru — o HMAC da Meta é calculado sobre estes bytes, não sobre o JSON reserializado. */
  raw: Buffer;
  headers: Record<string, string | undefined>;
  query: Record<string, string | undefined>;
}

export type MessagingSessionStatus =
  | 'CONNECTED'
  | 'CONNECTING'
  | 'DISCONNECTED'
  /** A instância não existe no provider (nunca criada ou apagada lá). Diferente de desconectada. */
  | 'NOT_CREATED';

export interface MessagingSession {
  status: MessagingSessionStatus;
  /** A sessão foi desfeita no provider; reconectar exige o mesmo número da conexão (`expectedPhone`). */
  error?: 'PHONE_MISMATCH' | 'PHONE_IN_USE' | 'PHONE_ARCHIVED';
  expectedPhone?: string;
  /** Data URI PNG para exibir e parear. Só existe enquanto `CONNECTING`. */
  qrCode?: string;
  pairingCode?: string;
  phoneNumber?: string;
}

/** Pareamento por QR; só em provider de WhatsApp Web — a Meta não implementa (número já verificado). */
export interface IMessagingSession {
  /** Cria a instância se não existir e devolve o QR. Idempotente. */
  connect(): Promise<MessagingSession>;
  /** Consulta o provider. Prefira `MessagingService.sessionStatus()`, que lê o estado empurrado por webhook. */
  status(): Promise<MessagingSession>;
  disconnect(): Promise<ProviderResult>;
}

export interface IMessagingProvider {
  /** Ausente = o provider não tem sessão a parear; a UI esconde a seção de QR. */
  readonly session?: IMessagingSession;
  capabilities(): MessagingCapabilities;
  send(input: SendMessageInput): Promise<SendResult>;
  /** Número da conta quando o provider o sabe sem pareamento (Meta); ausente no WhatsApp Web. */
  accountPhone?(): Promise<string | null>;
  /** Ausente = o provider não expõe perfil de contato (Meta, Evolution Go): a tela cai nas iniciais. */
  contactProfile?(phone: string): Promise<ContactProfile | null>;
  /** Busca os bytes no provider sob demanda. Lança se a mídia expirou ou o provider não a guarda mais. */
  downloadMedia(lookup: MediaLookup): Promise<DownloadedMedia>;
  /** Roda ANTES de qualquer parse. Nunca devolva `true` fixo — ver docs/backend/messaging.md. */
  verifyWebhook(req: WebhookRequest): boolean;
  /** Ausente = o provider não faz handshake de inscrição (só a Meta faz). `null` = recusado. */
  verifyChallenge?(query: Record<string, string | undefined>): string | null;
  parseWebhook(body: unknown): MessagingEvent[];
  /** Ausente = o provider não declara presença de saída (Meta não tem o conceito). */
  sendPresence?(phone: string, state: MessagingPresenceState): Promise<void>;
  validateConfiguration(): Promise<ProviderResult>;
  /** `{ status: false }` quando o provider não registra por API — a tela mostra a URL manual. */
  registerWebhook(url: string): Promise<ProviderResult>;
  /** Ausente = o provider não oferece inscrição de webhook removível por conexão. */
  unregisterWebhook?(): Promise<ProviderResult>;
  /** Ausente = o provider não expõe exclusão de instância (Evolution API, Meta). */
  deleteInstance?(): Promise<ProviderResult>;
  /** Ausente = o provider não tem fluxo de aprovação (Evolution). Cria ou edita (com `providerTemplateId`) na WABA. */
  submitTemplate?(
    definition: TemplateDefinition,
    providerTemplateId?: string,
  ): Promise<{ providerTemplateId: string }>;
  /** Ausente = o provider não tem catálogo remoto a limpar. */
  /** `providerTemplateId` restringe a remoção a UM idioma; sem ele a Meta apaga todos com esse nome. */
  deleteRemoteTemplate?(
    name: string,
    providerTemplateId?: string,
  ): Promise<ProviderResult>;
  /** Ausente = o provider não expõe reconciliação. Usado sob demanda, nunca por polling. */
  fetchTemplateStatuses?(): Promise<RemoteTemplateStatus[]>;
}

export interface IMessagingService<IConfig> {
  /** Valida o que o ADMIN digitou, antes de qualquer chamada de rede; entrada é `unknown` de propósito. */
  readonly configSchema: z.ZodType<IConfig, z.ZodTypeDef, unknown>;
  readonly messagingCapabilities: MessagingCapabilities;
  /** Todos os campos que o formulário pode enviar para `config` (segredos incluídos). O resto é descartado. */
  readonly configFields: readonly string[];
  /** Campos de `config` que são segredo: vão cifrados para o banco e nunca voltam em resposta de API. */
  readonly secretFields: readonly string[];
  /** Ausente = nenhum campo é gerado pelo sistema. Estável entre edições via `previous`. */
  systemFields?(previous?: Record<string, string>): Record<string, string>;
  use(config: IConfig): IMessagingProvider;
}

/** Tipo que o provider ativo não suporta — traduzido para mensagem i18n pelo use-case. */
export class UnsupportedMessageTypeError extends Error {
  constructor(
    readonly provider: string,
    readonly messageType: string,
  ) {
    super(`${provider} não suporta mensagem do tipo ${messageType}`);
    this.name = 'UnsupportedMessageTypeError';
  }
}
