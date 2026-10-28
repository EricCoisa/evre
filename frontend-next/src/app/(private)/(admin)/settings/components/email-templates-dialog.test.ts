import { describe, it, expect } from 'vitest';
import { renderPreview } from './email-templates-dialog';

const vars = [
  { name: 'name', labelKey: 'emailVariable_name', dummy: 'Maria Silva' },
  { name: 'action_url', labelKey: 'emailVariable_action_url', dummy: 'https://exemplo.com' },
];

describe('renderPreview', () => {
  it('troca o token pelo valor fictício', () => {
    expect(renderPreview('<p>Olá {{name}}</p>', vars)).toBe('<p>Olá Maria Silva</p>');
  });

  it('aceita espaços dentro das chaves', () => {
    expect(renderPreview('<p>{{ name }}</p>', vars)).toBe('<p>Maria Silva</p>');
  });

  it('troca todas as ocorrências, não só a primeira', () => {
    expect(renderPreview('{{name}} e {{name}}', vars)).toBe('Maria Silva e Maria Silva');
  });

  it('deixa intacto token que não é variável do tipo', () => {
    expect(renderPreview('<p>{{desconhecido}}</p>', vars)).toBe('<p>{{desconhecido}}</p>');
  });

  it('não confunde nomes com prefixo comum', () => {
    expect(renderPreview('{{action_url}}', vars)).toBe('https://exemplo.com');
  });
});
