import { describe, expect, it } from 'vitest';
import { contractChanged } from './template-types';

const base = {
  variables: [{ name: 'order', type: 'STRING', required: true }],
  buttons: [{ key: 'accept', kind: 'QUICK_REPLY', required: true }],
};

describe('contractChanged', () => {
  it('mesma coisa com chaves em outra ordem e campos vazios não é mudança', () => {
    expect(
      contractChanged(base, {
        variables: [{ required: true, type: 'STRING', name: 'order', default: '', sensitive: false }],
        buttons: [{ required: true, kind: 'QUICK_REPLY', key: 'accept', urlBase: undefined }],
      }),
    ).toBe(false);
  });

  it('variável nova, removida, com tipo diferente ou obrigatoriedade trocada é mudança', () => {
    const variants = [
      [...base.variables, { name: 'x', type: 'STRING', required: true }],
      [],
      [{ name: 'order', type: 'DATE', required: true }],
      [{ name: 'order', type: 'STRING', required: false, default: '-' }],
    ];
    for (const variables of variants) {
      expect(contractChanged(base, { ...base, variables })).toBe(true);
    }
  });

  it('botão novo, removido ou com URL diferente é mudança', () => {
    expect(contractChanged(base, { ...base, buttons: [] })).toBe(true);
    expect(
      contractChanged(
        { ...base, buttons: [{ key: 'go', kind: 'URL', urlBase: 'https://a.b/', required: true }] },
        { ...base, buttons: [{ key: 'go', kind: 'URL', urlBase: 'https://c.d/', required: true }] },
      ),
    ).toBe(true);
  });
});
