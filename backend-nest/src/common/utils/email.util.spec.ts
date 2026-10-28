const readFileFn = vi.hoisted(() => vi.fn());

vi.mock('fs', () => ({
  promises: { readFile: readFileFn },
}));

import { renderTemplate, renderTemplateFromFile } from './email.util';

describe('renderTemplate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('replaces a simple variable', () => {
    expect(renderTemplate('Hello {{ name }}!', { name: 'World' })).toBe(
      'Hello World!',
    );
  });

  it('returns empty string for a missing variable', () => {
    expect(renderTemplate('Hello {{ missing }}!', {})).toBe('Hello !');
  });

  it('resolves nested keys with dot notation', () => {
    expect(
      renderTemplate('{{ user.email }}', { user: { email: 'a@b.com' } }),
    ).toBe('a@b.com');
  });

  it('handles number values', () => {
    expect(renderTemplate('{{ count }}', { count: 42 })).toBe('42');
  });

  it('handles boolean values', () => {
    expect(renderTemplate('{{ flag }}', { flag: true })).toBe('true');
  });

  it('handles Date values by converting to ISO string', () => {
    const d = new Date('2020-01-01T00:00:00.000Z');
    expect(renderTemplate('{{ date }}', { date: d })).toBe(d.toISOString());
  });

  it('handles object values via JSON.stringify', () => {
    expect(renderTemplate('{{ obj }}', { obj: { x: 1 } })).toBe('{"x":1}');
  });

  it('catches JSON.stringify error for circular objects and returns empty string', () => {
    const circular: any = {};
    circular.self = circular;
    expect(renderTemplate('{{ obj }}', { obj: circular })).toBe('');
  });

  it('escapes HTML special characters when escapeHtml is true', () => {
    const result = renderTemplate(
      '{{ v }}',
      { v: '<div>"it\'s" &</div>' },
      { escapeHtml: true },
    );
    expect(result).toContain('&lt;');
    expect(result).toContain('&gt;');
    expect(result).toContain('&quot;');
    expect(result).toContain('&#39;');
    expect(result).toContain('&amp;');
  });

  it('does not escape HTML by default', () => {
    expect(renderTemplate('{{ v }}', { v: '<b>' })).toBe('<b>');
  });

  it('returns empty string for null vars argument', () => {
    expect(renderTemplate('{{ x }}', null)).toBe('');
  });

  it('returns empty string when nested key traversal hits null', () => {
    expect(renderTemplate('{{ user.name }}', { user: null })).toBe('');
  });

  // {{#if}} — botão que depende de uma variável opcional (ex.: action_url) não pode sobrar
  // morto no email quando o chamador não manda link nenhum.
  it('{{#if}} keeps the block when the variable is truthy', () => {
    const tpl = 'before {{#if action_url}}<a href="{{action_url}}">go</a>{{/if}} after';
    expect(renderTemplate(tpl, { action_url: 'https://x.com' })).toBe(
      'before <a href="https://x.com">go</a> after',
    );
  });

  it('{{#if}} drops the whole block when the variable is missing', () => {
    const tpl = 'before {{#if action_url}}<a href="{{action_url}}">go</a>{{/if}} after';
    expect(renderTemplate(tpl, {})).toBe('before  after');
  });

  it('{{#if}} drops the whole block when the variable is an empty string', () => {
    const tpl = 'before {{#if action_url}}<a href="{{action_url}}">go</a>{{/if}} after';
    expect(renderTemplate(tpl, { action_url: '' })).toBe('before  after');
  });

  it('{{#if}} supports more than one conditional block in the same template', () => {
    const tpl = '{{#if a}}A{{/if}}-{{#if b}}B{{/if}}';
    expect(renderTemplate(tpl, { a: 'x', b: '' })).toBe('A-');
  });
});

describe('renderTemplateFromFile', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads file with default utf8 encoding and renders template', async () => {
    readFileFn.mockResolvedValue('Hello {{ name }}!');
    const result = await renderTemplateFromFile('/fake/path.html', {
      name: 'Test',
    });
    expect(readFileFn).toHaveBeenCalledWith('/fake/path.html', {
      encoding: 'utf8',
    });
    expect(result).toBe('Hello Test!');
  });

  it('passes custom encoding to fs.readFile', async () => {
    readFileFn.mockResolvedValue('{{ v }}');
    await renderTemplateFromFile('/f.html', { v: 'x' }, { encoding: 'ascii' });
    expect(readFileFn).toHaveBeenCalledWith('/f.html', { encoding: 'ascii' });
  });

  it('passes escapeHtml option through to renderTemplate', async () => {
    readFileFn.mockResolvedValue('{{ v }}');
    const result = await renderTemplateFromFile(
      '/f.html',
      { v: '<b>' },
      { escapeHtml: true },
    );
    expect(result).toBe('&lt;b&gt;');
  });
});
