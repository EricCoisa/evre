/** Inicialização do Sentry. */
import 'dotenv/config';
import * as Sentry from '@sentry/nestjs';

/** Liga o SDK se houver DSN e ninguém tiver ligado antes; idempotente. */
export function initSentry(dsn: string | null | undefined): boolean {
  if (!dsn?.trim() || Sentry.getClient()) return false;

  Sentry.init({
    dsn: dsn.trim(),
    environment: process.env.NODE_ENV,
  });
  // Única pista de que o Sentry está ligado — a ausência desta linha no boot
  // significa DSN faltando.
  console.log(
    `[Sentry] ativo (environment=${process.env.NODE_ENV ?? 'undefined'})`,
  );
  return true;
}

/** Desliga o SDK do Sentry já inicializado. */
export async function disableSentry(): Promise<boolean> {
  const client = Sentry.getClient();
  if (!client) return false;

  await client.close();
  console.log('[Sentry] desligado por SYSTEM_SENTRY_ENABLED=false');
  return true;
}

initSentry(process.env.SENTRY_DSN);
