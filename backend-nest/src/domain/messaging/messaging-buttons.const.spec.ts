import { BadRequestException } from '@nestjs/common';
import {
  RESERVED_BUTTON_LIST,
  ReservedButtonKey,
  buttonSlotVariables,
  decodeButtonPayload,
  effectiveButtonSlots,
  encodeButtonPayload,
  assertButtonsMatchSlots,
  resolveButtons,
  sensitiveButtonNames,
  slotUrl,
} from './messaging-buttons.const';

const stored = [
  { key: 'details', kind: 'QUICK_REPLY' as const },
  { key: 'track', kind: 'URL' as const, urlBase: 'https://app.test/o/', sensitive: true },
  { key: 'opt_out', kind: 'QUICK_REPLY' as const, reserved: true },
  { key: 'inventado', kind: 'QUICK_REPLY' as const, reserved: true },
];

describe('payload dos botões', () => {
  it('chave sozinha ou chave:dado; o dado pode conter ":"', () => {
    expect(encodeButtonPayload('details')).toBe('details');
    expect(encodeButtonPayload('details', '42')).toBe('details:42');
    expect(decodeButtonPayload('details')).toEqual({ key: 'details', data: null });
    expect(decodeButtonPayload('details:a:b')).toEqual({ key: 'details', data: 'a:b' });
  });

  it('payload fora do formato (id de outro sistema) é ignorado', () => {
    expect(decodeButtonPayload('Change Button!')).toBeNull();
    expect(decodeButtonPayload('')).toBeNull();
  });

  it('dado que estoura o limite é recusado', () => {
    expect(() => encodeButtonPayload('k', 'x'.repeat(200))).toThrow(BadRequestException);
  });
});

describe('effectiveButtonSlots', () => {
  it('junta custom e reservados conhecidos; reservado desconhecido é descartado', () => {
    const slots = effectiveButtonSlots(stored);
    expect(slots.map((s) => s.key)).toEqual(['details', 'track', 'opt_out']);
    expect(slots.find((s) => s.key === 'opt_out')).toMatchObject({
      reserved: true,
      required: false,
      kind: 'QUICK_REPLY',
      defaultLabel: RESERVED_BUTTON_LIST[0].defaultLabel,
    });
  });

  it('URL expõe a base, o placeholder e a variável obrigatória do sufixo', () => {
    const [, track] = effectiveButtonSlots(stored);
    expect(slotUrl(track)).toBe('https://app.test/o/{{ track }}');
    expect(buttonSlotVariables([track])).toEqual([
      { name: 'track', type: 'STRING', required: true, default: undefined },
    ]);
    expect(sensitiveButtonNames([track])).toEqual(['track']);
  });
});

describe('resolveButtons', () => {
  const slots = effectiveButtonSlots(stored);

  it('resposta rápida leva a chave (e o dado) como payload; URL leva o sufixo', () => {
    const { values, payloads } = resolveButtons(slots, {
      details: '42',
      track: ' abc123 ',
      [ReservedButtonKey.OPT_OUT]: true,
    });
    expect(payloads).toEqual({ details: 'details:42', opt_out: 'opt_out' });
    expect(values).toEqual({ track: 'abc123' });
  });

  it('URL sem valor é erro (a Meta recusa parâmetro vazio)', () => {
    expect(() => resolveButtons(slots, {})).toThrow(/obrigatório ausente: track/);
  });

  it('sufixo com espaço, placeholder ou esquema é recusado', () => {
    for (const bad of ['a b', '{{x}}', 'https://evil.test']) {
      expect(() => resolveButtons(slots, { track: bad })).toThrow(BadRequestException);
    }
  });

  it('chave que o template não tem é erro (typo não passa calado)', () => {
    expect(() => resolveButtons(slots, { track: 'x', detail: '1' })).toThrow(/desconhecido.*detail/);
  });
});

describe('assertButtonsMatchSlots', () => {
  const slots = effectiveButtonSlots([
    { key: 'accept', kind: 'QUICK_REPLY' },
    { key: 'track', kind: 'URL', urlBase: 'https://app.test/o/' },
    { key: 'opt_out', kind: 'QUICK_REPLY', reserved: true },
  ]);
  const accept = { kind: 'QUICK_REPLY' as const, label: 'Aceitar', slot: 'accept' };
  const track = { kind: 'URL' as const, label: 'Ver', url: 'https://outro.test/x', slot: 'track' };

  it('força a URL do tipo e remove o payload salvo; botão livre passa intacto', () => {
    const free = { kind: 'URL' as const, label: 'Site', url: 'https://meu.site/a' };
    const result = assertButtonsMatchSlots(slots, [
      { ...accept, payload: 'forjado' } as never,
      track,
      free,
    ]);
    expect(result).toEqual([
      { kind: 'QUICK_REPLY', label: 'Aceitar', slot: 'accept' },
      { kind: 'URL', label: 'Ver', url: 'https://app.test/o/{{ track }}', slot: 'track' },
      free,
    ]);
  });

  it('espaço obrigatório ausente, espaço desconhecido, repetido ou de outro tipo é erro', () => {
    expect(() => assertButtonsMatchSlots(slots, [accept])).toThrow(/obrigatórios.*track/);
    expect(() => assertButtonsMatchSlots(slots, [accept, track, { ...accept, slot: 'xx' }])).toThrow(/não tem: xx/);
    expect(() => assertButtonsMatchSlots(slots, [accept, accept, track])).toThrow(/repetido/);
    expect(() =>
      assertButtonsMatchSlots(slots, [{ kind: 'URL', label: 'x', url: 'https://a.b', slot: 'accept' }, track]),
    ).toThrow(/QUICK_REPLY, não URL/);
  });

  it('reservado é opcional; tipo sem espaços aceita só botões livres', () => {
    expect(assertButtonsMatchSlots(slots, [accept, track])).toHaveLength(2);
    expect(assertButtonsMatchSlots([], [{ kind: 'QUICK_REPLY', label: 'Oi' }])).toHaveLength(1);
    expect(assertButtonsMatchSlots([], undefined)).toBeUndefined();
  });
});
