import { describe, expect, it } from 'vitest';
import { createEditor, ParagraphNode, TextNode } from 'lexical';
import { exportWhatsAppText, importWhatsAppText, serializeWhatsAppText } from './whatsapp-rich-text';

function createTestEditor() {
  return createEditor({
    nodes: [ParagraphNode, TextNode],
  });
}

describe('serializeWhatsAppText', () => {
  it('leaves spaces between differently formatted words unformatted', () => {
    const message =
      serializeWhatsAppText('teste ', 'bold') +
      serializeWhatsAppText('Teste', 'italic') +
      serializeWhatsAppText(' Teste ', 'italic') +
      serializeWhatsAppText('Teste', null);

    expect(message).toBe('*teste* _Teste_ _Teste_ Teste');
  });

  it('keeps every whitespace run outside formatting markers', () => {
    expect(serializeWhatsAppText('one two\nthree', 'bold')).toBe('*one* *two*\n*three*');
  });

  it('leaves unformatted text unchanged', () => {
    expect(serializeWhatsAppText('one two', null)).toBe('one two');
  });
});

describe('importWhatsAppText and exportWhatsAppText round-trip', () => {
  it('imports and exports plain text and bold', () => {
    const editor = createTestEditor();
    editor.update(() => importWhatsAppText('Olá *mundo*'), { discrete: true });
    const exported = editor.getEditorState().read(exportWhatsAppText);
    expect(exported).toBe('Olá *mundo*');
  });

  it('imports and exports font size tags [fs:text-lg]', () => {
    const editor = createTestEditor();
    editor.update(() => importWhatsAppText('Normal [fs:text-lg]Texto Grande[/fs] Fim'), { discrete: true });
    const exported = editor.getEditorState().read(exportWhatsAppText);
    expect(exported).toBe('Normal [fs:text-lg]Texto Grande[/fs] Fim');
  });

  it('consolidates adjacent styled nodes with the same font size', () => {
    const editor = createTestEditor();
    editor.update(() => importWhatsAppText('[fs:text-lg]Texto *em negrito* grande[/fs]'), { discrete: true });
    const exported = editor.getEditorState().read(exportWhatsAppText);
    expect(exported).toBe('[fs:text-lg]Texto *em* *negrito* grande[/fs]');
  });
});
