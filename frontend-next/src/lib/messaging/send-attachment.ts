import { MESSAGES_PROXY_PATH } from './media';

export interface SendAttachmentInput {
  connectionId: string;
  phone: string;
  file: File;
  caption?: string;
  /** Sem `type`, o backend deduz do mimetype (foto/vídeo/áudio); `DOCUMENT` força o envio como arquivo. */
  type?: 'DOCUMENT' | 'AUDIO';
}

/** `message` do envelope de erro do backend: texto, ou lista quando vem da validação. */
function errorMessage(body: unknown, fallback: string): string {
  const message = (body as { message?: unknown } | null)?.message;
  if (Array.isArray(message)) return message.join('; ');
  return typeof message === 'string' && message ? message : fallback;
}

/** Envia o anexo como multipart/form-data pelo proxy do front, que acrescenta o token da sessão. */
export async function sendAttachment(
  input: SendAttachmentInput,
): Promise<{ id: string }> {
  const form = new FormData();
  form.set('connectionId', input.connectionId);
  form.set('phone', input.phone);
  if (input.type) form.set('type', input.type);
  if (input.caption) form.set('caption', input.caption);
  form.set('file', input.file, input.file.name);

  const res = await fetch(MESSAGES_PROXY_PATH, { method: 'POST', body: form });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new Error(errorMessage(body, res.statusText));
  return body as { id: string };
}
