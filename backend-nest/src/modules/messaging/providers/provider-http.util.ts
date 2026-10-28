import type { ProviderResult } from 'src/domain/interface/provider-result';

/** Corpo JSON da resposta; `null` quando vazio ou inválido (um erro 502 de proxy vem em HTML). */
export async function readJson(res: Response): Promise<unknown> {
  return res.json().catch(() => null);
}

/** Extrai o texto de erro de qualquer um dos providers suportados. */
export function providerErrorText(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const { message, error } = body as { message?: unknown; error?: unknown };

  if (error && typeof error === 'object' && 'message' in error) {
    const {
      message: text,
      code,
      error_subcode: subcode,
      error_user_title: userTitle,
      error_user_msg: userMsg,
      error_data: errorData,
    } = error as {
      message?: string;
      code?: number;
      error_subcode?: number;
      error_user_title?: string;
      error_user_msg?: string;
      error_data?: { details?: string };
    };
    if (text) {
      const codes = [code, subcode].filter((c) => c != null).join('/');
      const head = codes ? `${text} (code ${codes})` : text;
      // A Meta devolve o motivo legível em error_user_*; "Invalid parameter" sozinho não ajuda ninguém.
      // `error_data.details` é onde a Meta diz QUAL parâmetro falhou quando a mensagem é só "Invalid parameter".
      const detail = [userTitle, userMsg, errorData?.details]
        .filter(Boolean)
        .join(' — ');
      return detail ? `${head}: ${detail}` : head;
    }
  }

  const raw = message ?? error;
  if (raw == null) return null;
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) {
    return raw
      .map((item) => (typeof item === 'string' ? item : JSON.stringify(item)))
      .join('; ');
  }
  return JSON.stringify(raw);
}

/** Mensagem de falha de rede ou de código; o que vira `data` de um `ProviderResult` com `status: false`. */
export function failureResult(error: unknown): ProviderResult {
  return { status: false, data: String((error as Error)?.message ?? error) };
}

/** Devolve a descrição de status HTTP ou texto amigável caso statusText seja vazio ou <none>. */
export function resolveStatusText(res: Response): string {
  const text = res.statusText?.trim();
  if (text && text.toLowerCase() !== '<none>') return text;

  switch (res.status) {
    case 400:
      return 'Requisição inválida (Bad Request)';
    case 401:
      return 'Credencial inválida ou expirada (Unauthorized)';
    case 403:
      return 'Acesso não permitido (Forbidden)';
    case 404:
      return 'Recurso não encontrado (Not Found)';
    case 408:
      return 'Tempo de requisição esgotado (Request Timeout)';
    case 429:
      return 'Muitas requisições (Too Many Requests)';
    case 500:
      return 'Erro interno do servidor';
    case 502:
      return 'Servidor do provider indisponível (Bad Gateway)';
    case 503:
      return 'Serviço indisponível (Service Unavailable)';
    case 504:
      return 'Tempo limite esgotado (Gateway Timeout)';
    case 520:
      return 'Erro desconhecido do servidor de origem';
    case 521:
      return 'Servidor de mensageria está desligado ou inacessível (Connection Refused)';
    case 522:
      return 'Tempo limite de conexão esgotado (Connection Timed Out). Verifique se o servidor está online e a URL está acessível.';
    case 523:
      return 'Servidor de mensageria inalcançável (Origin Unreachable)';
    case 524:
      return 'Tempo limite esgotado aguardando resposta do servidor do provider';
    default:
      return `HTTP ${res.status}`;
  }
}

/** `ProviderResult` de uma resposta HTTP já lida: ok devolve `okData`, falha devolve o texto do provider. */
export function resultFromResponse(
  res: Response,
  body: unknown,
  okData: string,
): ProviderResult {
  return res.ok
    ? { status: true, data: okData }
    : {
        status: false,
        data:
          providerErrorText(body) ??
          `HTTP ${res.status}: ${resolveStatusText(res)}`,
      };
}

/** Teto de uma chamada comum ao provider: acima disso o provider está fora e quem espera é um worker ou o operador. */
export const PROVIDER_TIMEOUT_MS = 30_000;
/** Download de mídia (tamanho desconhecido de antemão): o corpo pode ter dezenas de MB. */
export const PROVIDER_TRANSFER_TIMEOUT_MS = 120_000;

/** Calcula o prazo de upload a partir do tamanho do anexo, até o teto de transferência. */
export function uploadTimeoutMs(bytes: number): number {
  return Math.min(
    PROVIDER_TIMEOUT_MS + Math.ceil(bytes / 1_000_000) * 1_000,
    PROVIDER_TRANSFER_TIMEOUT_MS,
  );
}

/** O provider não respondeu a tempo. Distinto de recusa (`ProviderRequestError`): o envio PODE ter sido aceito. */
export class ProviderTimeoutError extends Error {
  constructor(
    url: string,
    readonly timeoutMs: number,
  ) {
    super(
      `Provider não respondeu em ${timeoutMs / 1000}s (${new URL(url).host})`,
    );
    this.name = 'ProviderTimeoutError';
  }
}

/** fetch com prazo total para a resposta inteira, corpo incluído. */
export async function providerFetch(
  url: string,
  init: RequestInit = {},
  timeoutMs: number = PROVIDER_TIMEOUT_MS,
): Promise<Response> {
  try {
    return await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new ProviderTimeoutError(url, timeoutMs);
    }
    throw error;
  }
}

/** Falha HTTP de um provider: carrega o status para quem precisa separar erro do operador de erro do provider. */
export class ProviderRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** Texto do provider sem o prefixo `<provider> <status>:`, próprio para mostrar ao operador. */
    readonly detail: string,
  ) {
    super(message);
    this.name = 'ProviderRequestError';
  }
}

/** Identifica falha transitória de provider (5xx/429/408 ou conexão recusada) que pode ser repetida. */
export function isTransientProviderError(error: unknown): boolean {
  if (error instanceof ProviderRequestError) {
    return error.status >= 500 || error.status === 429 || error.status === 408;
  }
  return error instanceof TypeError && error.message === 'fetch failed';
}

/** `fetch` que lança `"<provider> <status>: <texto>"` em resposta não-2xx e devolve o corpo JSON. */
export async function requestJson(
  label: string,
  url: string,
  init: RequestInit,
  timeoutMs?: number,
): Promise<unknown> {
  const res = await providerFetch(url, init, timeoutMs);
  const body = await readJson(res);
  if (!res.ok) {
    const detail = providerErrorText(body) ?? resolveStatusText(res);
    throw new ProviderRequestError(
      `${label} ${res.status}: ${detail}`,
      res.status,
      detail,
    );
  }
  return body;
}

/** Extensão de arquivo a partir do mimetype (`audio/ogg; codecs=opus` → `ogg`), para nomear mídia sem nome. */
export function extensionFromMime(mimeType: string | undefined): string {
  const subtype = mimeType?.split('/')[1]?.split(';')[0]?.trim();
  if (!subtype) return 'bin';
  return subtype === 'jpeg' ? 'jpg' : subtype.replace(/\+.*$/, '');
}
