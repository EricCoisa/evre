import { BadRequestException } from '@nestjs/common';
import {
  assertAllResolved,
  assertBodyMatchesType,
  catalogName,
  extractPlaceholders,
  flattenTemplate,
  formatValues,
  renderBody,
  renderResolvedParts,
} from './template.util';

describe('formatValues', () => {
  const variables = [
    { name: 'first_name', type: 'STRING' as const, required: true },
    { name: 'discount', type: 'STRING' as const, required: false, default: '10%' },
  ];

  it('usa o valor informado quando presente', () => {
    expect(formatValues(variables, { first_name: 'Ana', discount: '20%' })).toEqual({
      first_name: 'Ana',
      discount: '20%',
    });
  });

  it('variável opcional sem valor cai no default', () => {
    expect(formatValues(variables, { first_name: 'Ana' })).toEqual({
      first_name: 'Ana',
      discount: '10%',
    });
  });

  it('variável obrigatória ausente lança 400', () => {
    expect(() => formatValues(variables, {})).toThrow(BadRequestException);
  });

  it('DATE aplica o formato (ou DD/MM/YYYY por padrão)', () => {
    const dateVars = [{ name: 'due', type: 'DATE' as const, required: true }];
    expect(formatValues(dateVars, { due: '2026-03-05' })).toEqual({ due: '05/03/2026' });
  });
});

describe('renderBody', () => {
  it('delega em renderTemplate (email.util)', () => {
    expect(renderBody('Olá {{ first_name }}', { first_name: 'Ana' })).toBe('Olá Ana');
  });
});

describe('extractPlaceholders', () => {
  it('lista os nomes usados em {{ nome }}', () => {
    expect(extractPlaceholders('{{ a }} e {{b}} e {{ a }}')).toEqual(['a', 'b', 'a']);
  });
});

describe('assertBodyMatchesType', () => {
  const variables = [{ name: 'first_name' }];

  it('aceita quando toda variável usada existe no tipo', () => {
    expect(() =>
      assertBodyMatchesType(variables, { body: 'Olá {{ first_name }}' }),
    ).not.toThrow();
  });

  it('rejeita variável desconhecida no corpo, header, footer ou botão URL', () => {
    expect(() =>
      assertBodyMatchesType(variables, { body: 'Olá {{ last_name }}' }),
    ).toThrow(BadRequestException);
    expect(() =>
      assertBodyMatchesType(variables, {
        body: 'oi',
        header: { kind: 'TEXT' as const, text: '{{ last_name }}' },
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      assertBodyMatchesType(variables, {
        body: 'oi',
        buttons: [{ url: 'https://x.com/{{ last_name }}' }],
      }),
    ).toThrow(BadRequestException);
  });
});

describe('flattenTemplate', () => {
  it('junta header, corpo e footer em linhas separadas', () => {
    expect(
      flattenTemplate({
        name: 'x',
        language: 'pt-BR',
        category: 'UTILITY',
        values: {},
        body: 'corpo',
        header: { kind: 'TEXT', text: 'cabeçalho' },
        footer: 'rodapé',
      }),
    ).toEqual({ text: 'cabeçalho\n\ncorpo\n\nrodapé' });
  });

  it('botão URL vira texto no fim; COPY_CODE não acrescenta nada (código já está no corpo)', () => {
    expect(
      flattenTemplate({
        name: 'x',
        language: 'pt-BR',
        category: 'AUTHENTICATION',
        values: {},
        body: '123456 é seu código',
        buttons: [
          { kind: 'URL', label: 'Ver', url: 'https://x.com' },
          { kind: 'COPY_CODE', label: 'Copiar', payload: '123456' },
        ],
      }),
    ).toEqual({ text: '123456 é seu código\n\nVer: https://x.com' });
  });
});

describe('catalogName', () => {
  it('nome do catálogo é o key em minúsculas', () => {
    expect(catalogName('PASSWORD_CHANGED')).toBe('password_changed');
  });
});

describe('assertAllResolved', () => {
  it('placeholder sem valor em qualquer parte derruba o envio', () => {
    expect(() =>
      assertAllResolved({ body: 'oi', footer: 'ref {{ order }}' }, {}),
    ).toThrow(BadRequestException);
  });

  it('com valor para todos passa', () => {
    expect(() =>
      assertAllResolved({ body: 'oi {{ a }}', buttons: [{ url: 'x/{{ b }}' }] }, { a: '1', b: '2' }),
    ).not.toThrow();
  });
});

describe('formatValues — DATE inválida', () => {
  it('recusa em vez de formatar "Invalid Date"', () => {
    expect(() =>
      formatValues([{ name: 'd', type: 'DATE', required: true }], { d: 'abc' }),
    ).toThrow(BadRequestException);
  });
});

// Evolution não tem parâmetro nomeado: o texto sai achatado, então header/footer/URL precisam
// sair com os valores — só o corpo vinha renderizado e o resto ia com "{{ first_name }}" cru.
describe('flattenTemplate — variáveis fora do corpo', () => {
  it('renderiza header, footer e URL do botão com os valores', () => {
    const { text } = flattenTemplate({
      name: 'x',
      language: 'pt-BR',
      category: 'UTILITY',
      values: { first_name: 'Ana', order: '42' },
      body: 'corpo',
      header: { kind: 'TEXT', text: 'Olá {{ first_name }}' },
      footer: 'Pedido {{ order }}',
      buttons: [{ kind: 'URL', label: 'Ver', url: 'https://x.com/{{ order }}' }],
    });
    expect(text).toBe('Olá Ana\n\ncorpo\n\nPedido 42\n\nVer: https://x.com/42');
    expect(text).not.toContain('{{');
  });
});

// Template criado com a Meta continua enviável se a conexão for trocada por Evolution: os botões
// viram linhas de texto (resposta rápida e ação deixam de ser interativas; copiar código some).
describe('flattenTemplate — múltiplos botões (degradação na Evolution)', () => {
  it('URL e telefone viram "rótulo: valor", resposta rápida vira o texto e copiar código não aparece', () => {
    const { text } = flattenTemplate({
      name: 'x',
      language: 'pt-BR',
      category: 'MARKETING',
      values: { order: '42' },
      body: 'Seu pedido saiu',
      buttons: [
        { kind: 'URL', label: 'Rastrear', url: 'https://x.com/{{ order }}' },
        { kind: 'PHONE_NUMBER', label: 'Ligar', phoneNumber: '+5511999999999' },
        { kind: 'COPY_CODE', label: 'Copiar cupom' },
        { kind: 'QUICK_REPLY', label: 'Falar com atendente' },
      ],
    });
    expect(text).toBe(
      'Seu pedido saiu\n\nRastrear: https://x.com/42\n\nLigar: +5511999999999\n\nFalar com atendente',
    );
  });
});

describe('renderResolvedParts', () => {
  it('devolve header/footer/botões prontos para exibição, sem mexer no original', () => {
    const parts = renderResolvedParts({
      values: { first_name: 'Ana' },
      header: { kind: 'TEXT', text: '{{ first_name }}' },
      footer: 'até {{ first_name }}',
      buttons: [
        { kind: 'URL', label: 'Abrir', url: 'https://x.com/{{ first_name }}' },
        { kind: 'QUICK_REPLY', label: 'Ok' },
      ],
    });
    expect(parts.header).toEqual({ kind: 'TEXT', text: 'Ana' });
    expect(parts.footer).toBe('até Ana');
    expect(parts.buttons).toEqual([
      { kind: 'URL', label: 'Abrir', url: 'https://x.com/Ana' },
      { kind: 'QUICK_REPLY', label: 'Ok' },
    ]);
  });
});
