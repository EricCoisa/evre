import { describe, expect, it } from 'vitest';
import { parseWhatsAppFormat, type FormattedPart } from './format-whatsapp-text';

describe('parseWhatsAppFormat', () => {
  it('texto sem formatação volta como uma única parte text', () => {
    expect(parseWhatsAppFormat('oi tudo bem')).toEqual([{ type: 'text', text: 'oi tudo bem' }]);
  });

  it('string vazia não gera nenhuma parte', () => {
    expect(parseWhatsAppFormat('')).toEqual([]);
  });

  it('negrito simples', () => {
    expect(parseWhatsAppFormat('*oi*')).toEqual([
      { type: 'bold', parts: [{ type: 'text', text: 'oi' }] },
    ]);
  });

  it('itálico simples', () => {
    expect(parseWhatsAppFormat('_oi_')).toEqual([
      { type: 'italic', parts: [{ type: 'text', text: 'oi' }] },
    ]);
  });

  it('riscado simples', () => {
    expect(parseWhatsAppFormat('~oi~')).toEqual([
      { type: 'strikethrough', parts: [{ type: 'text', text: 'oi' }] },
    ]);
  });

  it('bloco de código simples', () => {
    expect(parseWhatsAppFormat('```const x = 1;```')).toEqual([
      { type: 'code', text: 'const x = 1;' },
    ]);
  });

  it('bloco de código com espaços é aparado (trim)', () => {
    expect(parseWhatsAppFormat('```  echo oi  ```')).toEqual([{ type: 'code', text: 'echo oi' }]);
  });

  it('texto antes e depois do negrito gera partes text separadas', () => {
    expect(parseWhatsAppFormat('antes *meio* depois')).toEqual([
      { type: 'text', text: 'antes ' },
      { type: 'bold', parts: [{ type: 'text', text: 'meio' }] },
      { type: 'text', text: ' depois' },
    ]);
  });

  it('vários negritos na mesma string', () => {
    expect(parseWhatsAppFormat('*um* e *dois*')).toEqual([
      { type: 'bold', parts: [{ type: 'text', text: 'um' }] },
      { type: 'text', text: ' e ' },
      { type: 'bold', parts: [{ type: 'text', text: 'dois' }] },
    ]);
  });

  it('itálico dentro de negrito (aninhamento)', () => {
    expect(parseWhatsAppFormat('*_oi_*')).toEqual([
      {
        type: 'bold',
        parts: [{ type: 'italic', parts: [{ type: 'text', text: 'oi' }] }],
      },
    ]);
  });

  it('riscado dentro de itálico dentro de negrito', () => {
    expect(parseWhatsAppFormat('*_~oi~_*')).toEqual([
      {
        type: 'bold',
        parts: [
          {
            type: 'italic',
            parts: [{ type: 'strikethrough', parts: [{ type: 'text', text: 'oi' }] }],
          },
        ],
      },
    ]);
  });

  it('código não é processado por dentro: negrito dentro de ``` fica literal', () => {
    expect(parseWhatsAppFormat('```*não é negrito*```')).toEqual([
      { type: 'code', text: '*não é negrito*' },
    ]);
  });

  it('código e negrito combinados fora do bloco', () => {
    expect(parseWhatsAppFormat('*bold* ```code``` _italic_')).toEqual([
      { type: 'bold', parts: [{ type: 'text', text: 'bold' }] },
      { type: 'text', text: ' ' },
      { type: 'code', text: 'code' },
      { type: 'text', text: ' ' },
      { type: 'italic', parts: [{ type: 'text', text: 'italic' }] },
    ]);
  });

  it('asterisco sem par fecha como texto comum', () => {
    expect(parseWhatsAppFormat('oi * tudo bem')).toEqual([
      { type: 'text', text: 'oi * tudo bem' },
    ]);
  });

  it('sublinha sem par fica como texto comum', () => {
    expect(parseWhatsAppFormat('a_b')).toEqual([{ type: 'text', text: 'a_b' }]);
  });

  it('marcador vazio (**) não casa — texto literal', () => {
    const result = parseWhatsAppFormat('**') as FormattedPart[];
    expect(result).toEqual([{ type: 'text', text: '**' }]);
  });

  it('negrito seguido de itálico adjacentes', () => {
    expect(parseWhatsAppFormat('*bold*_italic_')).toEqual([
      { type: 'bold', parts: [{ type: 'text', text: 'bold' }] },
      { type: 'italic', parts: [{ type: 'text', text: 'italic' }] },
    ]);
  });

  it('múltiplos blocos de código separados por texto', () => {
    expect(parseWhatsAppFormat('```a``` meio ```b```')).toEqual([
      { type: 'code', text: 'a' },
      { type: 'text', text: ' meio ' },
      { type: 'code', text: 'b' },
    ]);
  });

  it('formatação com tamanho de fonte [fs:text-lg]', () => {
    expect(parseWhatsAppFormat('[fs:text-lg]texto grande[/fs]')).toEqual([
      {
        type: 'sized',
        size: 'text-lg',
        parts: [{ type: 'text', text: 'texto grande' }],
      },
    ]);
  });

  it('formatação com tamanho de fonte contendo negrito', () => {
    expect(parseWhatsAppFormat('normal [fs:text-xl]*negrito grande*[/fs] fim')).toEqual([
      { type: 'text', text: 'normal ' },
      {
        type: 'sized',
        size: 'text-xl',
        parts: [{ type: 'bold', parts: [{ type: 'text', text: 'negrito grande' }] }],
      },
      { type: 'text', text: ' fim' },
    ]);
  });
});
