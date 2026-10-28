import { CreateMessagingTemplateSchema, UpdateMessagingTemplateSchema } from './messaging-template.dto';

const base = { typeId: 't', key: 'K', language: 'pt-BR', category: 'UTILITY', body: 'oi' };
const url = (n: number) => ({ kind: 'URL', label: `Ver ${n}`, url: `https://x.com/${n}` });
const phone = { kind: 'PHONE_NUMBER', label: 'Ligar', phoneNumber: '+5511999999999' };
const quick = (n: number) => ({ kind: 'QUICK_REPLY', label: `Sim ${n}` });

const parse = (buttons: unknown[]) => CreateMessagingTemplateSchema.safeParse({ ...base, buttons });

describe('botões do template', () => {
  it('aceita a combinação dentro dos limites (2 URL + 1 telefone + respostas rápidas)', () => {
    expect(parse([url(1), url(2), phone, quick(1), quick(2)]).success).toBe(true);
  });

  it('recusa mais de 2 URL', () => {
    expect(parse([url(1), url(2), url(3)]).success).toBe(false);
  });

  it('recusa mais de 1 telefone e mais de 1 copiar código', () => {
    expect(parse([phone, { ...phone, label: 'Outro' }]).success).toBe(false);
    const copy = { kind: 'COPY_CODE', label: 'Copiar' };
    expect(parse([copy, { ...copy, label: 'Copiar 2' }]).success).toBe(false);
  });

  it('recusa passar de 10 botões no total', () => {
    expect(parse(Array.from({ length: 11 }, (_, i) => quick(i))).success).toBe(false);
    expect(parse(Array.from({ length: 10 }, (_, i) => quick(i))).success).toBe(true);
  });
});

describe('chave e idioma do template', () => {
  const create = (over: Record<string, unknown>) =>
    CreateMessagingTemplateSchema.safeParse({ ...base, ...over }).success;

  it('chave vira nome no catálogo do provider: letra inicial, letras/números/_', () => {
    expect(create({ key: 'PASSWORD_CHANGED' })).toBe(true);
    expect(create({ key: 'order2_new' })).toBe(true);
    for (const key of ['com espaço', 'com-hifen', '1inicio', 'açaí', '']) {
      expect(create({ key })).toBe(false);
    }
  });

  it('idioma em formato BCP 47 simples', () => {
    expect(create({ language: 'pt-BR' })).toBe(true);
    expect(create({ language: 'en' })).toBe(true);
    for (const language of ['PT-br', 'portugues', 'p', 'pt_BR']) {
      expect(create({ language })).toBe(false);
    }
  });
});

describe('botão ligado a um espaço do tipo (slot) atravessa a validação do DTO', () => {
  const base2 = { typeId: 't', key: 'UPDATE_PROJECT', language: 'pt-BR', category: 'UTILITY', body: 'Olá {{ first_name }}, tudo bem?' };

  it('Create: o `slot` não é descartado em nenhum tipo de botão', () => {
    const parsed = CreateMessagingTemplateSchema.parse({
      ...base2,
      buttons: [
        { kind: 'URL', label: 'Acompanhar', url: 'https://evre.com.br/{{ project_link }}', slot: 'project_link' },
        { kind: 'QUICK_REPLY', label: 'Ok', slot: 'ok' },
        { kind: 'PHONE_NUMBER', label: 'Ligar', phoneNumber: '+5511999999999', slot: 'call' },
        { kind: 'COPY_CODE', label: 'Copiar', slot: 'copy' },
      ],
    });
    expect(parsed.buttons?.map((b) => (b as { slot?: string }).slot)).toEqual([
      'project_link',
      'ok',
      'call',
      'copy',
    ]);
  });

  it('Update também preserva o slot', () => {
    const parsed = UpdateMessagingTemplateSchema.parse({
      buttons: [{ kind: 'QUICK_REPLY', label: 'Ok', slot: 'ok' }],
    });
    expect((parsed.buttons?.[0] as { slot?: string }).slot).toBe('ok');
  });

  it('slot é opcional (botão livre) e tem formato de chave', () => {
    expect(CreateMessagingTemplateSchema.safeParse({ ...base2, buttons: [{ kind: 'QUICK_REPLY', label: 'Ok' }] }).success).toBe(true);
    expect(
      CreateMessagingTemplateSchema.safeParse({ ...base2, buttons: [{ kind: 'QUICK_REPLY', label: 'Ok', slot: 'Com Espaço' }] }).success,
    ).toBe(false);
  });
});
