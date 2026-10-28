/** Falha em que a fila não deve tentar de novo, convertida pelo processor em `UnrecoverableError`. */
export class MessagingNonRetryableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'MessagingNonRetryableError';
  }
}
