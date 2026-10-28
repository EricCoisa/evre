import { checkMetaTemplateRules, metaErrors } from './meta-template-rules';

const check = (over: Record<string, unknown> = {}) =>
  checkMetaTemplateRules({
    category: 'UTILITY',
    body: 'Olá {{ nome }}, seu pedido {{ pedido }} foi confirmado e sai amanhã.',
    ...over,
  } as never);
const codes = (over?: Record<string, unknown>) => check(over).map((i) => i.code);

describe('regras da Meta para template', () => {
  it('template bem formado não tem problema algum', () => {
    expect(check()).toEqual([]);
  });

  describe('variável no início e no fim do corpo', () => {
    it('começar com variável é erro, com ou sem espaço antes', () => {
      expect(codes({ body: '{{ nome }}, seu pedido saiu hoje.' })).toContain('BODY_STARTS_WITH_VARIABLE');
      expect(codes({ body: '  {{ nome }}, seu pedido saiu hoje.' })).toContain('BODY_STARTS_WITH_VARIABLE');
    });

    it('terminar com variável é erro, mesmo com espaço ou quebra de linha depois', () => {
      expect(codes({ body: 'Seu pedido é o {{ pedido }}' })).toContain('BODY_ENDS_WITH_VARIABLE');
      expect(codes({ body: 'Seu pedido é o {{ pedido }}  \n' })).toContain('BODY_ENDS_WITH_VARIABLE');
    });

    it('pontuação depois da variável resolve', () => {
      expect(codes({ body: 'Seu pedido é o {{ pedido }}.' })).not.toContain('BODY_ENDS_WITH_VARIABLE');
    });

    it('os dois ao mesmo tempo geram os dois erros', () => {
      expect(codes({ body: '{{ a }} fala com {{ b }}' })).toEqual(
        expect.arrayContaining(['BODY_STARTS_WITH_VARIABLE', 'BODY_ENDS_WITH_VARIABLE']),
      );
    });
  });

  it('variáveis coladas são erro; separadas por texto, não', () => {
    expect(codes({ body: 'Olá {{ a }}{{ b }} tudo bem por aí hoje.' })).toContain('BODY_ADJACENT_VARIABLES');
    expect(codes({ body: 'Olá {{ a }} {{ b }} tudo bem por aí hoje.' })).not.toContain('BODY_ADJACENT_VARIABLES');
  });

  it('rodapé com variável é erro', () => {
    const issues = check({ footer: 'Pedido {{ pedido }}' });
    expect(issues).toContainEqual(expect.objectContaining({ code: 'FOOTER_HAS_VARIABLE', severity: 'error', field: 'footer' }));
    expect(codes({ footer: 'Obrigado pela preferência' })).toEqual([]);
  });

  describe('links encurtados', () => {
    it('no corpo, no header, no rodapé e na URL do botão', () => {
      for (const over of [
        { body: 'Olá {{ nome }}, veja https://bit.ly/abc123 para detalhes do pedido.' },
        { header: { text: 'Veja https://tinyurl.com/x' } },
        { footer: 'https://t.co/xyz' },
        { buttons: [{ kind: 'URL', label: 'Ver', url: 'https://www.bit.ly/{{ id }}' }] },
      ]) {
        expect(codes(over)).toContain('URL_SHORTENER');
      }
    });

    it('domínio próprio não é encurtador', () => {
      expect(codes({ buttons: [{ kind: 'URL', label: 'Ver', url: 'https://app.exemplo.com/p/{{ id }}' }] })).toEqual([]);
    });
  });

  describe('avisos (não barram)', () => {
    it('texto dominado por variáveis', () => {
      const issues = check({ body: 'Oi {{ a }} {{ b }} {{ c }} ok.' });
      expect(issues).toContainEqual(expect.objectContaining({ code: 'BODY_TOO_MANY_VARIABLES', severity: 'warning' }));
      expect(metaErrors(issues)).toEqual([]);
    });

    it('Utilidade sem nenhuma variável parece genérica (risco de virar Marketing)', () => {
      expect(codes({ body: 'Sua compra foi confirmada com sucesso, obrigado.' })).toContain('UTILITY_WITHOUT_VARIABLES');
      expect(codes({ category: 'MARKETING', body: 'Aproveite nossas ofertas desta semana.' })).toEqual([]);
    });

    it('muitas quebras de linha seguidas e telefone sem código do país', () => {
      expect(codes({ body: 'Olá {{ a }}, tudo bem?\n\n\n\nAbraço da equipe.' })).toContain('BODY_TOO_MANY_LINE_BREAKS');
      expect(codes({ buttons: [{ kind: 'PHONE_NUMBER', label: 'Ligar', phoneNumber: '11 99999-9999' }] })).toContain(
        'PHONE_WITHOUT_COUNTRY_CODE',
      );
      expect(codes({ buttons: [{ kind: 'PHONE_NUMBER', label: 'Ligar', phoneNumber: '+55 11 99999-9999' }] })).toEqual([]);
    });
  });

  it('autenticação tem corpo fixo da Meta: nenhuma regra se aplica ao texto local', () => {
    expect(check({ category: 'AUTHENTICATION', body: '{{ code }}', footer: '{{ x }}' })).toEqual([]);
  });

  it('metaErrors separa só o que barra a submissão', () => {
    const issues = check({ body: '{{ a }} oi', footer: 'x' });
    expect(metaErrors(issues).every((i) => i.severity === 'error')).toBe(true);
    expect(metaErrors(issues).length).toBeGreaterThan(0);
  });
});
