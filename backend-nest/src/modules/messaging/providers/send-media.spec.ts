import type { ResolvedTemplate } from 'src/domain/interface/messaging-provider.interface';
import { EvolutionApiProvider } from './evolution-api.provider';
import { EvolutionGoProvider } from './evolution-go.provider';
import { MetaProvider } from './meta.provider';
import { unreachableMediaReason } from './media-url.util';

const evo = { baseUrl: 'http://evo', token: 't', instance: 'inst' };
import { GO_PLAIN_CONFIG } from '../test-utils/messaging-fixtures';
const go = { ...GO_PLAIN_CONFIG, baseUrl: 'http://go' };
const meta = { phoneNumberId: '1', accessToken: 'a', graphVersion: 'v21.0', wabaId: 'waba-1' };

const IMG = 'https://cdn.exemplo.com/foto.png';

function mockFetch(body: unknown) {
  const fn = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve(body),
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

const EVO_OK = { key: { id: 'X' } };
const GO_OK = { messageId: 'X' };
const META_OK = { messages: [{ id: 'X' }] };

const template = (over: Partial<ResolvedTemplate> = {}): ResolvedTemplate => ({
  name: 'pedido_enviado',
  language: 'pt_BR',
  category: 'UTILITY',
  values: { first_name: 'Ana', order: '#42' },
  body: 'Olá {{ first_name }}, seu pedido {{ order }} saiu',
  ...over,
});

describe('envio de mídia e template', () => {
  afterEach(() => vi.unstubAllGlobals());

  describe('Evolution API', () => {
    const p = () => new EvolutionApiProvider().use(evo);

    it('IMAGE vai por sendMedia com mediatype e caption', async () => {
      const f = mockFetch(EVO_OK);
      await p().send({
        type: 'IMAGE',
        phone: '5511999999999',
        mediaUrl: IMG,
        caption: 'oi',
      });

      const [url, init] = f.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://evo/message/sendMedia/inst');
      expect(JSON.parse(init.body as string)).toMatchObject({
        mediatype: 'image',
        media: IMG,
        caption: 'oi',
      });
    });

    it('DOCUMENT leva fileName', async () => {
      const f = mockFetch(EVO_OK);
      await p().send({
        type: 'DOCUMENT',
        phone: '5511999999999',
        mediaUrl: IMG,
        fileName: 'nota.pdf',
      });
      expect(
        JSON.parse((f.mock.calls[0][1] as RequestInit).body as string),
      ).toMatchObject({
        mediatype: 'document',
        fileName: 'nota.pdf',
      });
    });

    // Áudio tem rota própria na v2 — cai fora do sendMedia.
    it('AUDIO usa sendWhatsAppAudio, não sendMedia', async () => {
      const f = mockFetch(EVO_OK);
      await p().send({ type: 'AUDIO', phone: '5511999999999', mediaUrl: IMG });

      expect(f.mock.calls[0][0]).toBe(
        'http://evo/message/sendWhatsAppAudio/inst',
      );
      expect(
        JSON.parse((f.mock.calls[0][1] as RequestInit).body as string),
      ).toMatchObject({
        audio: IMG,
      });
    });

    // WhatsApp Web não tem catálogo aprovado nem janela de 24h: o template achata em texto.
    it('TEMPLATE degrada para texto achatado (corpo já renderizado)', async () => {
      const f = mockFetch(EVO_OK);
      await p().send({
        type: 'TEMPLATE',
        phone: '5511999999999',
        template: template({ body: 'Olá Ana, seu pedido #42 saiu' }),
      });

      expect(f.mock.calls[0][0]).toBe('http://evo/message/sendText/inst');
      expect(
        JSON.parse((f.mock.calls[0][1] as RequestInit).body as string).text,
      ).toBe('Olá Ana, seu pedido #42 saiu');
    });

    it('TEMPLATE achata header, footer e botão URL em linhas separadas', async () => {
      const f = mockFetch(EVO_OK);
      await p().send({
        type: 'TEMPLATE',
        phone: '5511999999999',
        template: template({
          body: 'corpo',
          header: { kind: 'TEXT', text: 'cabeçalho' },
          footer: 'rodapé',
          buttons: [{ kind: 'URL', label: 'Ver pedido', url: 'https://x.com/42' }],
        }),
      });

      expect(
        JSON.parse((f.mock.calls[0][1] as RequestInit).body as string).text,
      ).toBe('cabeçalho\n\ncorpo\n\nrodapé\n\nVer pedido: https://x.com/42');
    });
  });

  describe('Meta', () => {
    const p = () => new MetaProvider().use(meta);

    it('IMAGE usa envelope image.link', async () => {
      const f = mockFetch(META_OK);
      await p().send({
        type: 'IMAGE',
        phone: '5511999999999',
        mediaUrl: IMG,
        caption: 'oi',
      });

      expect(
        JSON.parse((f.mock.calls[0][1] as RequestInit).body as string),
      ).toMatchObject({
        type: 'image',
        image: { link: IMG, caption: 'oi' },
      });
    });

    it('DOCUMENT usa `filename` (minúsculo), diferente da Evolution', async () => {
      const f = mockFetch(META_OK);
      await p().send({
        type: 'DOCUMENT',
        phone: '5511999999999',
        mediaUrl: IMG,
        fileName: 'nota.pdf',
      });
      expect(
        JSON.parse((f.mock.calls[0][1] as RequestInit).body as string),
      ).toMatchObject({
        type: 'document',
        document: { filename: 'nota.pdf' },
      });
    });

    // Aqui TEMPLATE é real: fora da janela de 24h a Meta só aceita template aprovado.
    it('TEMPLATE monta name, language e parâmetros NOMEADOS — nunca reenvia o texto', async () => {
      const f = mockFetch(META_OK);
      await p().send({
        type: 'TEMPLATE',
        phone: '5511999999999',
        template: template(),
      });

      const body = JSON.parse(
        (f.mock.calls[0][1] as RequestInit).body as string,
      );
      expect(body.type).toBe('template');
      expect(body.template).toMatchObject({
        name: 'pedido_enviado',
        language: { code: 'pt_BR' },
      });
      expect(body.template.components).toEqual([
        {
          type: 'body',
          parameters: [
            { type: 'text', parameter_name: 'first_name', text: 'Ana' },
            { type: 'text', parameter_name: 'order', text: '#42' },
          ],
        },
      ]);
    });

    it('corpo comum: parâmetros saem do corpo-fonte, não do renderizado', async () => {
      const f = mockFetch(META_OK);
      await p().send({
        type: 'TEMPLATE',
        phone: '5511999999999',
        template: template({
          body: 'Olá Ana, seu pedido #42 saiu',
          bodySource: 'Olá {{ first_name }}, seu pedido {{ order }} saiu',
        }),
      });
      const body = JSON.parse((f.mock.calls[0][1] as RequestInit).body as string);
      expect(body.template.components).toEqual([
        {
          type: 'body',
          parameters: [
            { type: 'text', parameter_name: 'first_name', text: 'Ana' },
            { type: 'text', parameter_name: 'order', text: '#42' },
          ],
        },
      ]);
    });

    // Regressão: 132000 "Number of parameters does not match". O texto local tem header com
    // {{ first_name }}, mas o template AUTHENTICATION da Meta não tem header e tem corpo posicional.
    it('AUTHENTICATION envia só o código: corpo posicional + botão OTP, sem header nem parâmetro nomeado', async () => {
      const f = mockFetch(META_OK);
      await p().send({
        type: 'TEMPLATE',
        phone: '5511999999999',
        template: template({
          name: 'auth',
          language: 'pt-BR',
          category: 'AUTHENTICATION',
          header: { kind: 'TEXT', text: 'Olá {{ first_name }}' },
          // Como o resolve() entrega: `body` já renderizado, `bodySource` com os placeholders.
          body: 'Seu código de autenticação é: 0000200',
          bodySource: 'Seu código de autenticação é: {{ code }}',
          values: { first_name: 'Éric', code: '0000200' },
        }),
      });

      const body = JSON.parse(
        (f.mock.calls[0][1] as RequestInit).body as string,
      );
      expect(body.template.components).toEqual([
        { type: 'body', parameters: [{ type: 'text', text: '0000200' }] },
        {
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [{ type: 'text', text: '0000200' }],
        },
      ]);
    });

    it('resposta rápida com payload envia o componente quick_reply na posição certa; URL segue com o seu', async () => {
      const f = mockFetch(META_OK);
      await p().send({
        type: 'TEMPLATE',
        phone: '5511999999999',
        template: template({
          body: 'oi',
          bodySource: 'oi',
          values: { track: 'abc' },
          buttons: [
            { kind: 'URL', label: 'Ver', url: 'https://app.test/o/{{ track }}', slot: 'track' },
            { kind: 'QUICK_REPLY', label: 'Sim', payload: 'accept:42', slot: 'accept' },
            { kind: 'QUICK_REPLY', label: 'Livre' },
          ],
        }),
      });
      const body = JSON.parse((f.mock.calls[0][1] as RequestInit).body as string);
      expect(body.template.components).toEqual([
        {
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [{ type: 'text', text: 'abc' }],
        },
        {
          type: 'button',
          sub_type: 'quick_reply',
          index: '1',
          parameters: [{ type: 'payload', payload: 'accept:42' }],
        },
      ]);
    });

    it('idioma BCP 47 vira POSIX (pt-BR → pt_BR)', async () => {
      const f = mockFetch(META_OK);
      await p().send({
        type: 'TEMPLATE',
        phone: '5511999999999',
        template: template({ language: 'pt-BR', body: 'oi', values: {} }),
      });
      const body = JSON.parse(
        (f.mock.calls[0][1] as RequestInit).body as string,
      );
      expect(body.template.language).toEqual({ code: 'pt_BR' });
    });

    it('template sem variáveis não manda components', async () => {
      const f = mockFetch(META_OK);
      await p().send({
        type: 'TEMPLATE',
        phone: '5511999999999',
        template: template({ body: 'oi', values: {} }),
      });
      const body = JSON.parse(
        (f.mock.calls[0][1] as RequestInit).body as string,
      );
      expect(body.template.components).toBeUndefined();
    });

    it('header TEXT e botão URL com variável ganham componentes nomeados próprios', async () => {
      const f = mockFetch(META_OK);
      await p().send({
        type: 'TEMPLATE',
        phone: '5511999999999',
        template: template({
          body: 'corpo sem variável',
          values: { order: '42' },
          header: { kind: 'TEXT', text: 'Pedido {{ order }}' },
          buttons: [{ kind: 'URL', label: 'Ver', url: 'https://x.com/p/{{ order }}' }],
        }),
      });
      const body = JSON.parse(
        (f.mock.calls[0][1] as RequestInit).body as string,
      );
      expect(body.template.components).toEqual([
        {
          type: 'header',
          parameters: [{ type: 'text', parameter_name: 'order', text: '42' }],
        },
        {
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [{ type: 'text', text: '42' }],
        },
      ]);
    });
  });

  describe('Evolution Go', () => {
    it('mídia vai por /send/media com url e type', async () => {
      const f = mockFetch(GO_OK);
      await new EvolutionGoProvider().use(go).send({
        type: 'VIDEO',
        phone: '5511999999999',
        mediaUrl: IMG,
        caption: 'c',
      });

      expect(f.mock.calls[0][0]).toBe('http://go/send/media');
      expect(
        JSON.parse((f.mock.calls[0][1] as RequestInit).body as string),
      ).toMatchObject({
        url: IMG,
        type: 'video',
        caption: 'c',
      });
    });
  });
});

describe('unreachableMediaReason', () => {
  it('aceita URL pública', () => {
    expect(unreachableMediaReason(IMG)).toBeNull();
  });

  // O caso real: storage LOCAL em dev gera URL que o provider nunca alcança.
  it('recusa host privado com motivo específico', () => {
    for (const url of [
      'http://localhost:3000/uploads/a.png',
      'http://127.0.0.1/a.png',
      'http://192.168.0.10/a.png',
      'http://10.1.2.3/a.png',
      'http://172.16.0.1/a.png',
    ]) {
      expect(unreachableMediaReason(url)).toMatch(/host privado/);
    }
  });

  // Antes só IPv4 privado clássico era barrado: estas formas passavam e geravam o erro genérico do provider.
  it('recusa IPv6 local, IPv4 embutido em IPv6, CGNAT e nomes de rede interna', () => {
    for (const url of [
      'http://[::1]/a.png',
      'http://[::ffff:7f00:1]/a.png', // ::ffff:127.0.0.1
      'http://[::ffff:a00:1]/a.png', // ::ffff:10.0.0.1
      'http://[fd12:3456::1]/a.png', // ULA
      'http://[fe80::1]/a.png', // link-local
      'http://100.64.0.1/a.png',
      'http://0.0.0.0/a.png',
      'http://2130706433/a.png', // 127.0.0.1 em decimal: a URL normaliza
      'http://intranet.local/a.png',
      'http://metadata.internal/a.png',
      'http://minio:9000/a.png', // nome de serviço docker, sem ponto
      'http://localhost./a.png',
    ]) {
      expect(unreachableMediaReason(url), url).toMatch(/host privado/);
    }
  });

  it('não barra o que é público', () => {
    for (const url of [
      'https://cdn.exemplo.com/a.png',
      'http://8.8.8.8/a.png',
      'http://172.32.0.1/a.png', // fora de 172.16/12
      'http://100.128.0.1/a.png', // fora do CGNAT
      'http://[2606:4700::1111]/a.png',
      'https://bucket.s3.amazonaws.com/a.png',
    ]) {
      expect(unreachableMediaReason(url), url).toBeNull();
    }
  });

  it('recusa URL relativa e protocolo não-http', () => {
    expect(unreachableMediaReason('/uploads/a.png')).toMatch(/URL absoluta/);
    expect(unreachableMediaReason('file:///tmp/a.png')).toMatch(
      /http ou https/,
    );
  });
});
