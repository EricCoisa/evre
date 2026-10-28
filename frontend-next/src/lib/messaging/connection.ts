import type { MessagingConnection } from '@/lib/actions/messaging/types';

/** Provider e número: o que distingue uma conexão da outra para quem opera. */
export function connectionDisplayName(
  connection: Pick<MessagingConnection, 'provider' | 'phone'>,
): string {
  return connection.phone ? `${connection.provider} · ${connection.phone}` : connection.provider;
}
