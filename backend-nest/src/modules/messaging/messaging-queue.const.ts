import { createHash } from 'crypto';
import type { JobsOptions } from 'bullmq';

/** Filas do módulo. Os nomes são o contrato com o Redis: mudar um deixa os jobs pendentes órfãos. */
export const MESSAGING_QUEUE = {
  INBOUND: 'messaging-inbound',
  BUTTONS: 'messaging-buttons',
} as const;

/** Número de filas de envio (partições), cada uma com um worker, que mantêm a ordem por conversa. */
export const MESSAGING_SEND_PARTITIONS = 8;

/** Nomes das filas de envio, uma por partição. */
export const SEND_QUEUE_NAMES: readonly string[] = Array.from(
  { length: MESSAGING_SEND_PARTITIONS },
  (_, index) => (index === 0 ? 'messaging' : `messaging-send-${index}`),
);

/** Token de injeção da lista de filas de envio, na ordem das partições. */
export const MESSAGING_SEND_QUEUES = 'MESSAGING_SEND_QUEUES';

/** Partição da conversa: estável para a mesma (conexão, contato). */
export function sendPartition(connectionId: string, contactId: string): number {
  const digest = createHash('sha1')
    .update(`${connectionId}:${contactId}`)
    .digest();
  return digest.readUInt32BE(0) % MESSAGING_SEND_PARTITIONS;
}

/** Pausas entre tentativas de um envio, feitas dentro do worker para erro transitório do provider. */
export const MESSAGING_SEND_RETRY_DELAYS_MS: readonly number[] = [
  1_000, 5_000, 15_000,
];

/** Janela após a qual uma mensagem `QUEUED` é considerada linha órfã, não mais "ainda saindo". */
export const MESSAGING_PENDING_WINDOW_MS = 5 * 60_000;

/** Tentativas por job das filas de entrada e de botões (o envio repete por conta própria, acima). */
export const MESSAGING_JOB_ATTEMPTS = 5;

/** Retenção de jobs falhos para diagnóstico, limitada para a fila não crescer sem limite. */
const FAILED_JOB_RETENTION = { age: 7 * 24 * 3600, count: 1_000 } as const;

/** O job de um envio com variável sensível carrega o valor real: não pode sobrar por dias. */
const SENSITIVE_FAILED_JOB_RETENTION = { age: 3_600 } as const;

/** Monta as opções do job de envio, usando o id da mensagem como `jobId` para não duplicar o envio. */
export function sendJobOptions(
  messageId: string,
  sensitive: boolean,
): JobsOptions {
  return {
    jobId: messageId,
    attempts: 1,
    removeOnComplete: true,
    removeOnFail: sensitive
      ? SENSITIVE_FAILED_JOB_RETENTION
      : FAILED_JOB_RETENTION,
  };
}

export const INBOUND_JOB_OPTIONS: JobsOptions = {
  attempts: MESSAGING_JOB_ATTEMPTS,
  backoff: { type: 'exponential', delay: 5_000 },
  removeOnComplete: true,
  removeOnFail: FAILED_JOB_RETENTION,
};

export function buttonJobOptions(eventId: string): JobsOptions {
  return {
    jobId: eventId,
    attempts: MESSAGING_JOB_ATTEMPTS,
    backoff: { type: 'exponential', delay: 10_000 },
    removeOnComplete: true,
    removeOnFail: FAILED_JOB_RETENTION,
  };
}
