import { BadRequestException } from '@nestjs/common';
import { conformTemplateToType, templateProblem } from './template-conformance.util';

const TYPE = {
  variables: [
    { name: 'order', type: 'STRING', required: true },
    { name: 'note', type: 'STRING', required: false, default: '-' },
    { name: 'full_name', reserved: true },
  ],
  buttons: [
    { key: 'accept', kind: 'QUICK_REPLY' },
    { key: 'track', kind: 'URL', urlBase: 'https://app.test/o/' },
  ],
};
const accept = { kind: 'QUICK_REPLY', label: 'Aceitar', slot: 'accept' };
const track = { kind: 'URL', label: 'Ver', url: 'x', slot: 'track' };
const content = (over: Record<string, unknown> = {}) => ({
  category: 'UTILITY',
  body: 'Pedido {{ order }}',
  buttons: [accept, track],
  ...over,
});

describe('conformTemplateToType — a regra do contrato, no servidor', () => {
  it('template que cumpre o tipo passa e devolve os botões normalizados', () => {
    const { buttons } = conformTemplateToType(TYPE, content());
    expect(buttons?.[1]).toMatchObject({ url: 'https://app.test/o/{{ track }}' });
  });

  it('variável desconhecida no texto, em qualquer parte (corpo, header, footer, URL livre)', () => {
    for (const over of [
      { body: 'Oi {{ inventada }} {{ order }}' },
      { header: { text: '{{ inventada }}' } },
      { footer: '{{ inventada }}' },
    ]) {
      expect(() => conformTemplateToType(TYPE, content(over))).toThrow(/desconhecida.*inventada/);
    }
  });

  it('variável obrigatória do tipo que o texto não usa é recusada; opcional e reservada não exigem uso', () => {
    expect(() => conformTemplateToType(TYPE, content({ body: 'sem variável' }))).toThrow(
      /obrigatórias.*order/,
    );
    expect(() => conformTemplateToType(TYPE, content())).not.toThrow(); // note/full_name ausentes: ok
  });

  it('obrigatória usada só no header/footer/URL também conta', () => {
    expect(() =>
      conformTemplateToType(TYPE, content({ body: 'oi', footer: 'Pedido {{ order }}' })),
    ).not.toThrow();
  });

  it('botão obrigatório do tipo ausente é recusado', () => {
    expect(() => conformTemplateToType(TYPE, content({ buttons: [accept] }))).toThrow(/obrigatórios.*track/);
  });

  it('autenticação ignora botões e o sufixo do link não vira variável obrigatória', () => {
    const { buttons } = conformTemplateToType(TYPE, content({ category: 'AUTHENTICATION', buttons: [] }));
    expect(buttons).toBeUndefined();
  });

  it('slots: "skip" mantém os botões que o template já tem, sem exigir os do tipo', () => {
    const { buttons } = conformTemplateToType(TYPE, content({ buttons: undefined }), { slots: 'skip' });
    expect(buttons).toBeUndefined();
  });
});

describe('templateProblem', () => {
  it('devolve o motivo em texto, ou null quando cumpre', () => {
    expect(templateProblem(TYPE, content())).toBeNull();
    expect(templateProblem(TYPE, content({ body: 'oi' }))).toContain('order');
  });

  it('erro que não é de validação não é engolido', () => {
    expect(() => templateProblem(null as never, content())).toThrow();
    expect(new BadRequestException('x')).toBeDefined();
  });
});
