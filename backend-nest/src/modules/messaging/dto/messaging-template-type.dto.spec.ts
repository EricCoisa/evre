import {
  CreateMessagingTemplateTypeSchema,
  TemplateButtonSlotSchema,
  TemplateButtonSlotsSchema,
  TemplateVariableSchema,
  TemplateVariablesSchema,
} from './messaging-template-type.dto';

describe('TemplateVariableSchema', () => {
  it('reservada liberável com reserved: true é aceita, sem exigir default', () => {
    const r = TemplateVariableSchema.safeParse({
      name: 'first_name',
      type: 'STRING',
      required: false,
      reserved: true,
    });
    expect(r.success).toBe(true);
  });

  it('reserved: true com nome que não é reservada é recusado', () => {
    const r = TemplateVariableSchema.safeParse({ name: 'order_id', type: 'STRING', reserved: true });
    expect(r.success).toBe(false);
  });

  it('nome snake_case é aceito', () => {
    expect(
      TemplateVariableSchema.safeParse({ name: 'order_id', type: 'STRING' }).success,
    ).toBe(true);
  });

  // camelCase não é normalizado para snake_case — é recusado, com mensagem, para o admin entender a reprovação.
  it('nome camelCase é recusado, sem normalização silenciosa', () => {
    const result = TemplateVariableSchema.safeParse({ name: 'lastName', type: 'STRING' });
    expect(result.success).toBe(false);
  });

  it('variável opcional (required: false) exige default não-vazio', () => {
    const withoutDefault = TemplateVariableSchema.safeParse({
      name: 'discount',
      type: 'STRING',
      required: false,
    });
    expect(withoutDefault.success).toBe(false);

    const withDefault = TemplateVariableSchema.safeParse({
      name: 'discount',
      type: 'STRING',
      required: false,
      default: '10%',
    });
    expect(withDefault.success).toBe(true);
  });

  it('required nasce true por default', () => {
    const parsed = TemplateVariableSchema.parse({ name: 'order_id', type: 'STRING' });
    expect(parsed.required).toBe(true);
  });

  it('nome reservado (first_name, full_name) é recusado, com mensagem', () => {
    for (const name of ['first_name', 'full_name']) {
      const result = TemplateVariableSchema.safeParse({ name, type: 'STRING' });
      expect(result.success).toBe(false);
    }
  });
});

describe('TemplateVariablesSchema', () => {
  it('respeita o teto de 32 variáveis', () => {
    const many = Array.from({ length: 33 }, (_, i) => ({
      name: `v${i}`,
      type: 'STRING' as const,
    }));
    expect(TemplateVariablesSchema.safeParse(many).success).toBe(false);
  });
});

describe('TemplateButtonSlotSchema / botões tipados do tipo', () => {
  const ok = (slot: unknown) => TemplateButtonSlotSchema.safeParse(slot).success;

  it('resposta rápida custom, URL com base e reservado liberável são aceitos', () => {
    expect(ok({ key: 'accept', kind: 'QUICK_REPLY' })).toBe(true);
    expect(ok({ key: 'track', kind: 'URL', urlBase: 'https://app.test/o/' })).toBe(true);
    expect(ok({ key: 'opt_out', kind: 'QUICK_REPLY', reserved: true })).toBe(true);
  });

  it('chave camelCase, URL sem base ou com variável, e base em resposta rápida são recusados', () => {
    expect(ok({ key: 'goDetails', kind: 'QUICK_REPLY' })).toBe(false);
    expect(ok({ key: 'track', kind: 'URL' })).toBe(false);
    expect(ok({ key: 'track', kind: 'URL', urlBase: 'https://app.test/{{ x }}' })).toBe(false);
    expect(ok({ key: 'track', kind: 'URL', urlBase: 'ftp://app.test' })).toBe(false);
    expect(ok({ key: 'accept', kind: 'QUICK_REPLY', urlBase: 'https://app.test/' })).toBe(false);
  });

  it('reservado desconhecido ou de outro tipo é recusado; custom não pode usar nome reservado', () => {
    expect(ok({ key: 'inventado', kind: 'QUICK_REPLY', reserved: true })).toBe(false);
    expect(ok({ key: 'opt_out', kind: 'URL', reserved: true, urlBase: 'https://a.b/' })).toBe(false);
    expect(ok({ key: 'opt_out', kind: 'QUICK_REPLY' })).toBe(false);
  });

  it('chaves repetidas e mais de 2 URLs são recusadas', () => {
    const q = (key: string) => ({ key, kind: 'QUICK_REPLY' });
    const u = (key: string) => ({ key, kind: 'URL', urlBase: 'https://a.b/' });
    expect(TemplateButtonSlotsSchema.safeParse([q('a'), q('a')]).success).toBe(false);
    expect(TemplateButtonSlotsSchema.safeParse([u('a'), u('b'), u('c')]).success).toBe(false);
    expect(TemplateButtonSlotsSchema.safeParse([u('a'), u('b'), q('c')]).success).toBe(true);
  });

  it('chave de botão URL não pode colidir com nome de variável do tipo', () => {
    const base = { key: 'T', name: 'Tipo' };
    const slot = { key: 'order_id', kind: 'URL', urlBase: 'https://a.b/' };
    expect(
      CreateMessagingTemplateTypeSchema.safeParse({
        ...base,
        variables: [{ name: 'order_id', type: 'STRING' }],
        buttons: [slot],
      }).success,
    ).toBe(false);
    expect(
      CreateMessagingTemplateTypeSchema.safeParse({ ...base, variables: [], buttons: [slot] }).success,
    ).toBe(true);
  });
});
