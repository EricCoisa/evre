import { describe, expect, it } from 'vitest';
import type { MessagingMessage } from '@/lib/actions/messaging/types';
import { buildThread, formatDayLabel } from './group-messages';

let seq = 0;
const msg = (
  createdAt: string,
  direction: 'INBOUND' | 'OUTBOUND' = 'INBOUND',
  id = `m${++seq}`,
): MessagingMessage => ({
  id,
  connectionId: 'conn-1',
  direction,
  status: 'DELIVERED',
  phone: '5511999990001',
  type: 'TEXT',
  text: id,
  createdAt,
});

describe('buildThread', () => {
  it('ordena do mais antigo para o mais novo e separa por dia', () => {
    const items = buildThread([
      msg('2026-10-03T12:00:00', 'INBOUND', 'c'),
      msg('2026-10-02T23:00:00', 'INBOUND', 'b'),
      msg('2026-10-02T09:00:00', 'INBOUND', 'a'),
    ]);
    expect(items.map((i) => (i.kind === 'day' ? 'day' : i.message.id))).toEqual([
      'day', 'a', 'b', 'day', 'c',
    ]);
  });

  it('descarta duplicatas que a paginação por offset repete', () => {
    const dup = msg('2026-10-03T10:00:00', 'INBOUND', 'x');
    const items = buildThread([dup, dup, msg('2026-10-03T09:00:00', 'INBOUND', 'y')]);
    expect(items.filter((i) => i.kind === 'message')).toHaveLength(2);
  });

  it('marca o início de cada sequência do mesmo lado, e reinicia após o separador de dia', () => {
    const items = buildThread([
      msg('2026-10-03T10:03:00', 'OUTBOUND', 'd'),
      msg('2026-10-03T10:02:00', 'INBOUND', 'c'),
      msg('2026-10-03T10:01:00', 'INBOUND', 'b'),
      msg('2026-10-02T10:00:00', 'INBOUND', 'a'),
    ]);
    const runs = items
      .filter((i) => i.kind === 'message')
      .map((i) => (i.kind === 'message' ? [i.message.id, i.startsRun] : []));
    expect(runs).toEqual([['a', true], ['b', true], ['c', false], ['d', true]]);
  });

  it('lista vazia não gera nada', () => {
    expect(buildThread([])).toEqual([]);
  });
});

describe('formatDayLabel', () => {
  const now = new Date('2026-10-03T15:00:00');
  const labels = { today: 'Hoje', yesterday: 'Ontem' };

  it('hoje e ontem', () => {
    expect(formatDayLabel(new Date('2026-10-03T01:00:00'), now, 'pt-BR', labels)).toBe('Hoje');
    expect(formatDayLabel(new Date('2026-10-02T23:59:00'), now, 'pt-BR', labels)).toBe('Ontem');
  });

  it('data por extenso; só inclui o ano quando não é o corrente', () => {
    expect(formatDayLabel(new Date('2026-09-10T10:00:00'), now, 'pt-BR', labels)).toBe('10 de setembro');
    expect(formatDayLabel(new Date('2025-09-10T10:00:00'), now, 'pt-BR', labels)).toBe('10 de setembro de 2025');
  });
});
