import { describe, expect, it } from 'vitest';
import { buildTemplateTypeSchema } from './template-type-schema';

const t = ((key: string) => key) as never;
const schema = buildTemplateTypeSchema(t, new Set(['first_name']), new Set(['opt_out']));

describe('schema do formulário do tipo', () => {
  it('"criar" sem marcar reservada nem adicionar nada passa: o FormBuilder entrega \'\' nos campos custom', () => {
    const parsed = schema.safeParse({
      key: 'ORDER',
      name: 'Pedido',
      variables: '',
      reservedVariables: '',
      buttons: '',
      reservedButtons: '',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toMatchObject({
        variables: [],
        reservedVariables: [],
        buttons: [],
        reservedButtons: [],
      });
    }
  });

  it('campos ausentes (undefined) também valem lista vazia', () => {
    expect(schema.safeParse({ key: 'ORDER', name: 'Pedido' }).success).toBe(true);
  });

  it('chave e nome continuam obrigatórios', () => {
    const parsed = schema.safeParse({ key: '', name: '' });
    expect(parsed.success).toBe(false);
  });

  it('variável com nome reservado ou fora do snake_case é recusada', () => {
    const bad = (name: string) =>
      schema.safeParse({
        key: 'K',
        name: 'N',
        variables: [{ name, type: 'STRING', required: true }],
      }).success;
    expect(bad('order_id')).toBe(true);
    expect(bad('first_name')).toBe(false);
    expect(bad('orderId')).toBe(false);
  });

  it('botão: chave reservada, repetida, colidindo com variável ou URL sem base válida são recusados', () => {
    const run = (buttons: unknown[], variables: unknown[] = []) =>
      schema.safeParse({ key: 'K', name: 'N', buttons, variables }).success;
    const quick = (key: string) => ({ key, kind: 'QUICK_REPLY', required: true });
    const url = (key: string, urlBase: string) => ({ key, kind: 'URL', required: true, urlBase });

    expect(run([quick('details'), url('track', 'https://app.test/o/')])).toBe(true);
    expect(run([quick('opt_out')])).toBe(false);
    expect(run([quick('a'), quick('a')])).toBe(false);
    expect(run([url('order', 'https://a.b/')], [{ name: 'order', type: 'STRING', required: true }])).toBe(false);
    expect(run([url('track', 'ftp://a.b')])).toBe(false);
    expect(run([url('track', 'https://a.b/{{ x }}')])).toBe(false);
  });
});
