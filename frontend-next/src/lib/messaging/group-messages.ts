import type { MessagingMessage } from '@/lib/actions/messaging/types';

export type ThreadItem =
  | { kind: 'day'; key: string; date: Date }
  | {
      kind: 'message';
      key: string;
      message: MessagingMessage;
      /** Primeira da sequência do mesmo lado: ganha respiro acima, como no WhatsApp Web. */
      startsRun: boolean;
    };

const dayKey = (date: Date) =>
  `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

/** Monta a lista da conversa em ordem cronológica, sem duplicatas, com separador por dia. */
export function buildThread(newestFirst: MessagingMessage[]): ThreadItem[] {
  const seen = new Set<string>();
  const ordered = newestFirst
    .filter((message) => !seen.has(message.id) && seen.add(message.id))
    .reverse();

  const items: ThreadItem[] = [];
  let currentDay = '';
  let previous: MessagingMessage | null = null;

  for (const message of ordered) {
    const date = new Date(message.createdAt);
    const key = dayKey(date);
    if (key !== currentDay) {
      currentDay = key;
      items.push({ kind: 'day', key: `day-${key}`, date });
      previous = null;
    }
    items.push({
      kind: 'message',
      key: message.id,
      message,
      startsRun: previous?.direction !== message.direction,
    });
    previous = message;
  }
  return items;
}

/** "Hoje", "Ontem" ou a data por extenso, no idioma do usuário. */
export function formatDayLabel(
  date: Date,
  now: Date,
  locale: string,
  labels: { today: string; yesterday: string },
): string {
  if (dayKey(date) === dayKey(now)) return labels.today;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (dayKey(date) === dayKey(yesterday)) return labels.yesterday;
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  }).format(date);
}
