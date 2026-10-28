import { describe, expect, it } from 'vitest';
import type { TemplateButton } from '@/lib/actions/messaging/types';
import {
  canAdd,
  categoryAllowsButtons,
  emptyButton,
  orderButtons,
  rebaseOnSlots,
  slotButton,
  slotUrl,
  slotsOf,
  toPayload,
  validateButton,
} from './template-buttons';

const url = (n: number): TemplateButton => ({ kind: 'URL', label: `Ver ${n}`, url: `https://x.com/${n}` });

describe('template-buttons', () => {
  it('autenticação não aceita botões nossos', () => {
    expect(categoryAllowsButtons('AUTHENTICATION')).toBe(false);
    expect(categoryAllowsButtons('UTILITY')).toBe(true);
    expect(categoryAllowsButtons('MARKETING')).toBe(true);
  });

  it('respeita o limite por tipo (2 URL, 1 telefone, 1 copiar código) e o total', () => {
    expect(canAdd([url(1)], 'URL')).toBe(true);
    expect(canAdd([url(1), url(2)], 'URL')).toBe(false);
    expect(canAdd([emptyButton('PHONE_NUMBER')], 'PHONE_NUMBER')).toBe(false);
    expect(canAdd([emptyButton('COPY_CODE')], 'COPY_CODE')).toBe(false);
    const ten = Array.from({ length: 10 }, () => emptyButton('QUICK_REPLY'));
    expect(canAdd(ten, 'QUICK_REPLY')).toBe(false);
    expect(canAdd(ten.slice(0, 9), 'QUICK_REPLY')).toBe(true);
  });

  it('respostas rápidas vão para o fim, preservando a ordem dentro de cada grupo', () => {
    const q1 = { kind: 'QUICK_REPLY' as const, label: 'A' };
    const q2 = { kind: 'QUICK_REPLY' as const, label: 'B' };
    expect(orderButtons([q1, url(1), q2, url(2)]).map((b) => b.label)).toEqual(['Ver 1', 'Ver 2', 'A', 'B']);
  });

  it('valida rótulo, URL (http/https, uma variável só no fim) e telefone', () => {
    expect(validateButton(url(1))).toBeNull();
    expect(validateButton({ kind: 'URL', label: '', url: 'https://x.com' })).toBe('buttonErrLabel');
    expect(validateButton({ kind: 'URL', label: 'a', url: 'x.com' })).toBe('buttonErrUrl');
    expect(validateButton({ kind: 'URL', label: 'a', url: 'https://x.com/{{ id }}' })).toBeNull();
    expect(validateButton({ kind: 'URL', label: 'a', url: 'https://x.com/{{ id }}/y' })).toBe('buttonErrUrlVars');
    expect(validateButton({ kind: 'URL', label: 'a', url: 'https://x.com/{{ a }}{{ b }}' })).toBe('buttonErrUrlVars');
    expect(validateButton({ kind: 'PHONE_NUMBER', label: 'Ligar', phoneNumber: 'abc' })).toBe('buttonErrPhone');
    expect(validateButton({ kind: 'PHONE_NUMBER', label: 'Ligar', phoneNumber: '+55 11 99999-9999' })).toBeNull();
  });

  it('toPayload apara textos', () => {
    expect(toPayload([{ kind: 'URL', label: ' Ver ', url: ' https://x.com ' }])).toEqual([
      { kind: 'URL', label: 'Ver', url: 'https://x.com' },
    ]);
  });

  it('toPayload apara o telefone e, para os demais tipos, só o label', () => {
    expect(toPayload([{ kind: 'PHONE_NUMBER', label: ' Ligar ', phoneNumber: ' +55 11 99999-9999 ' }])).toEqual([
      { kind: 'PHONE_NUMBER', label: 'Ligar', phoneNumber: '+55 11 99999-9999' },
    ]);
    expect(toPayload([{ kind: 'QUICK_REPLY', label: ' Ok ' }])).toEqual([
      { kind: 'QUICK_REPLY', label: 'Ok' },
    ]);
  });

  describe('espaços do tipo', () => {
    const reserved = [{ key: 'opt_out', kind: 'QUICK_REPLY', labelKey: 'x', defaultLabel: 'Parar', allowUse: true }] as never;
    const slots = slotsOf(
      [
        { key: 'accept', kind: 'QUICK_REPLY', required: true },
        { key: 'track', kind: 'URL', urlBase: 'https://app.test/o/' },
        { key: 'opt_out', kind: 'QUICK_REPLY', reserved: true },
        { key: 'sumiu', kind: 'QUICK_REPLY', reserved: true },
      ],
      reserved,
    );

    it('junta custom e reservados conhecidos; reservado que o código removeu é descartado', () => {
      expect(slots.map((s) => s.key)).toEqual(['accept', 'track', 'opt_out']);
      expect(slots[2]).toMatchObject({ reserved: true, required: false, defaultLabel: 'Parar' });
    });

    it('botão de URL carrega a URL do tipo (base + placeholder do sufixo)', () => {
      expect(slotUrl(slots[1])).toBe('https://app.test/o/{{ track }}');
      expect(slotButton(slots[1], 'Ver')).toEqual({
        kind: 'URL',
        label: 'Ver',
        url: 'https://app.test/o/{{ track }}',
        slot: 'track',
      });
      expect(validateButton(slotButton(slots[1], 'Ver'))).toBeNull();
    });

    it('sem label explícito, usa o defaultLabel do espaço reservado', () => {
      expect(slotButton(slots[2])).toEqual({ kind: 'QUICK_REPLY', label: 'Parar', slot: 'opt_out' });
    });

    it('trocar de tipo cria as linhas obrigatórias, mantém botões livres e descarta os do tipo antigo', () => {
      const free: TemplateButton = { kind: 'URL', label: 'Site', url: 'https://meu.site' };
      const old: TemplateButton = { kind: 'QUICK_REPLY', label: 'Velho', slot: 'removido' };
      const rebased = rebaseOnSlots([free, old], slots);
      expect(rebased.map((b) => b.slot ?? b.label)).toEqual(['accept', 'track', 'Site']);
    });
  });
});
