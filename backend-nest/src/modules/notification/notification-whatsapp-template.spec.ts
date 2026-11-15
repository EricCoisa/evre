import { readFileSync } from 'fs';
import { join } from 'path';
import {
  NOTIFICATION_WHATSAPP_TEMPLATE_KEY,
  NOTIFICATION_WHATSAPP_CTA_TEMPLATE_KEY,
} from '../../domain/notification/notification-config.const';

const seed = readFileSync(
  join(__dirname, '../../../prisma/seeds/messaging-templates.seed.ts'),
  'utf8',
);

/** Recorte do bloco do template NOTIFICATION, a partir do FK pro tipo (âncora única no arquivo). */
function templateBlock(): string {
  const idx = seed.indexOf('typeId: notificationTemplateType.id');
  expect(idx, 'template NOTIFICATION não encontrado no seed').toBeGreaterThan(-1);
  return seed.slice(idx, idx + 800);
}

/** Template de WhatsApp para notificações sem link. */
describe('seed — template de WhatsApp da notificação', () => {
  it(`tipo ${NOTIFICATION_WHATSAPP_TEMPLATE_KEY} é seedado com title/message custom e first_name reservada`, () => {
    const idx = seed.indexOf('notificationTemplateVariables');
    expect(idx, 'notificationTemplateVariables não encontrado no seed').toBeGreaterThan(-1);
    const block = seed.slice(idx, idx + 350);
    expect(block).toContain("name: 'title'");
    expect(block).toContain("name: 'message'");
    expect(block).toContain("name: 'first_name'");
    expect(block).toContain('reserved: true');
  });

  it('o template tem header de aviso, corpo com saudação + title/message, e é marcado isSystem', () => {
    const block = templateBlock();
    expect(block).toContain("kind: 'TEXT'");
    expect(block).toContain('{{ first_name }}');
    expect(block).toContain('{{ title }}');
    expect(block).toContain('{{ message }}');
    expect(block).toContain('isSystem: true');
  });

  // A Meta recusa corpo de template que termine em variável, ou cujo texto fixo seja dominado
  // pelas variáveis — já recusou uma versão anterior deste exato template por isso.
  it('o corpo não termina em variável e tem texto fixo suficiente (regra da Meta)', () => {
    const match = templateBlock().match(/body:\s*'([^']*)'/);
    expect(match, 'corpo do template NOTIFICATION não encontrado').toBeTruthy();
    const body = match![1].replace(/\\n/g, '\n');

    expect(body.trim().endsWith('}}')).toBe(false);

    const variableCount = [...body.matchAll(/\{\{\s*[\w.]+\s*\}\}/g)].length;
    const fixedWordCount = body
      .replace(/\{\{\s*[\w.]+\s*\}\}/g, ' ')
      .split(/\s+/)
      .filter(Boolean).length;
    expect(fixedWordCount).toBeGreaterThanOrEqual(variableCount * 2);
  });
});

/** Template de WhatsApp para notificações com botão CTA (actionUrl presente). */
describe(`seed — template de WhatsApp ${NOTIFICATION_WHATSAPP_CTA_TEMPLATE_KEY}`, () => {
  function ctaTemplateBlock(): string {
    const idx = seed.indexOf('typeId: notificationCtaTemplateType.id');
    expect(idx, 'template NOTIFICATION_CTA não encontrado no seed').toBeGreaterThan(-1);
    return seed.slice(idx, idx + 800);
  }

  it('seedado com title/message custom, first_name reservada e botão URL open', () => {
    const idx = seed.indexOf('notificationCtaTemplateVariables');
    expect(idx, 'notificationCtaTemplateVariables não encontrado no seed').toBeGreaterThan(-1);
    const block = seed.slice(idx, idx + 500);
    expect(block).toContain("name: 'title'");
    expect(block).toContain("name: 'message'");
    expect(block).toContain("name: 'first_name'");
    expect(block).toContain('reserved: true');
    expect(block).toContain("key: 'open'");
    expect(block).toContain("kind: 'URL'");
    expect(block).toContain('/s/');
  });

  it('o corpo não termina em variável e tem texto fixo suficiente (regra da Meta)', () => {
    const match = ctaTemplateBlock().match(/body:\s*'([^']*)'/);
    expect(match, 'corpo do template NOTIFICATION_CTA não encontrado').toBeTruthy();
    const body = match![1].replace(/\\n/g, '\n');

    expect(body.trim().endsWith('}}')).toBe(false);

    const variableCount = [...body.matchAll(/\{\{\s*[\w.]+\s*\}\}/g)].length;
    const fixedWordCount = body
      .replace(/\{\{\s*[\w.]+\s*\}\}/g, ' ')
      .split(/\s+/)
      .filter(Boolean).length;
    expect(fixedWordCount).toBeGreaterThanOrEqual(variableCount * 2);
  });

  it('tem botão URL com slot open apontando para urlBase /s/', () => {
    const block = ctaTemplateBlock();
    expect(block).toContain("kind: 'URL'");
    expect(block).toContain("slot: 'open'");
    expect(block).toContain('/s/');
    expect(block).toContain('{{ open }}');
  });
});
