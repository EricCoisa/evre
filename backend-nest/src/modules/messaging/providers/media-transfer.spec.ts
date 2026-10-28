import { EvolutionApiProvider } from './evolution-api.provider';
import { EvolutionGoProvider } from './evolution-go.provider';
import { MetaProvider } from './meta.provider';
import { parseBaileysMessage } from './webhook.util';

const evo = { baseUrl: 'http://evo', token: 't', instance: 'inst' };
import { GO_PLAIN_CONFIG } from '../test-utils/messaging-fixtures';
const go = { ...GO_PLAIN_CONFIG, baseUrl: 'http://go' };
const meta = { phoneNumberId: '1', accessToken: 'a', graphVersion: 'v21.0', wabaId: 'waba-1' };

const PNG = { data: Buffer.from('PNGBYTES'), mimeType: 'image/png' };
const jsonRes = (body: unknown) => ({
  ok: true,
  status: 200,
  statusText: 'OK',
  json: () => Promise.resolve(body),
});

function stubFetch(...responses: unknown[]) {
  const fn = vi.fn();
  responses.forEach((r) => fn.mockResolvedValueOnce(r));
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('upload de mídia (sem storage)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('Evolution API manda o arquivo em base64 no campo media', async () => {
    const f = stubFetch(jsonRes({ key: { id: 'X' } }));
    await new EvolutionApiProvider().use(evo).send({
      type: 'IMAGE',
      phone: '5511999999999',
      file: PNG,
      caption: 'oi',
    });

    const body = JSON.parse((f.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toMatchObject({
      mediatype: 'image',
      mimetype: 'image/png',
      media: PNG.data.toString('base64'),
      caption: 'oi',
    });
  });

  it('Evolution API manda áudio em base64 pela rota própria', async () => {
    const f = stubFetch(jsonRes({ key: { id: 'X' } }));
    await new EvolutionApiProvider().use(evo).send({
      type: 'AUDIO',
      phone: '5511999999999',
      file: { data: Buffer.from('OGG'), mimeType: 'audio/ogg' },
    });

    expect(f.mock.calls[0][0]).toBe(
      'http://evo/message/sendWhatsAppAudio/inst',
    );
    expect(
      JSON.parse((f.mock.calls[0][1] as RequestInit).body as string).audio,
    ).toBe(Buffer.from('OGG').toString('base64'));
  });

  it('Evolution Go usa multipart no /send/media, sem Content-Type manual', async () => {
    const f = stubFetch(jsonRes({ messageId: 'X' }));
    await new EvolutionGoProvider().use(go).send({
      type: 'DOCUMENT',
      phone: '5511999999999',
      file: PNG,
      fileName: 'a.png',
    });

    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://go/send/media');
    expect(init.headers).toEqual({ apikey: go.instanceToken });
    const form = init.body as FormData;
    expect(form.get('type')).toBe('document');
    expect(form.get('filename')).toBe('a.png');
    expect((form.get('file') as File).name).toBe('a.png');
  });

  it('Meta sobe o arquivo em /media e envia pelo id, devolvendo mediaRef', async () => {
    const f = stubFetch(
      jsonRes({ id: 'MEDIA1' }),
      jsonRes({ messages: [{ id: 'wamid.X' }] }),
    );
    const result = await new MetaProvider()
      .use(meta)
      .send({ type: 'IMAGE', phone: '5511999999999', file: PNG });

    const [uploadUrl, uploadInit] = f.mock.calls[0] as [string, RequestInit];
    expect(uploadUrl).toBe('https://graph.facebook.com/v21.0/1/media');
    expect((uploadInit.body as FormData).get('type')).toBe('image/png');

    const sent = JSON.parse((f.mock.calls[1][1] as RequestInit).body as string);
    expect(sent.image).toMatchObject({ id: 'MEDIA1' });
    expect(sent.image.link).toBeUndefined();
    expect(result).toMatchObject({
      providerMessageId: 'wamid.X',
      mediaRef: 'MEDIA1',
    });
  });
});

describe('download de mídia sob demanda', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('Evolution API reenvia o payload gravado e decodifica o base64', async () => {
    const stored = {
      key: { id: 'A', remoteJid: 'x' },
      message: { imageMessage: {} },
    };
    const f = stubFetch(
      jsonRes({
        base64: Buffer.from('IMG').toString('base64'),
        mimetype: 'image/jpeg',
        fileName: 'f.jpg',
      }),
    );
    const media = await new EvolutionApiProvider()
      .use(evo)
      .downloadMedia({ providerMessageId: 'A', fromMe: false, raw: stored });

    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://evo/chat/getBase64FromMediaMessage/inst');
    expect(JSON.parse(init.body as string).message).toEqual(stored);
    expect(media.data.toString()).toBe('IMG');
    expect(media.mimeType).toBe('image/jpeg');
  });

  it('Evolution API de mensagem nossa (sem payload do provider) manda só a chave', async () => {
    const f = stubFetch(jsonRes({ base64: 'QQ==', mimetype: 'image/png' }));
    await new EvolutionApiProvider().use(evo).downloadMedia({
      providerMessageId: 'B',
      fromMe: true,
      raw: { type: 'IMAGE' },
    });
    expect(
      JSON.parse((f.mock.calls[0][1] as RequestInit).body as string).message,
    ).toEqual({
      key: { id: 'B', fromMe: true },
    });
  });

  it('Evolution API sem base64 na resposta lança', async () => {
    stubFetch(jsonRes({}));
    await expect(
      new EvolutionApiProvider()
        .use(evo)
        .downloadMedia({ providerMessageId: 'A', fromMe: false, raw: null }),
    ).rejects.toThrow(/mídia/);
  });

  /** Confere que o mimetype é lido do prefixo da data URL quando o Go não manda campo separado. */
  describe('Evolution Go — mimetype vem do prefixo da data URL', () => {
    const download = (body: unknown) => {
      stubFetch(jsonRes(body));
      return new EvolutionGoProvider().use(go).downloadMedia({
        providerMessageId: 'A',
        fromMe: false,
        raw: { Message: { imageMessage: {} } },
      });
    };

    it('lê o tipo declarado na data URL e decodifica o base64', async () => {
      const media = await download({
        data: { base64: `data:image/jpeg;base64,${Buffer.from('JPG').toString('base64')}` },
      });

      expect(media.mimeType).toBe('image/jpeg');
      expect(media.data.toString()).toBe('JPG');
    });

    it('base64 cru, sem prefixo, cai em octet-stream', async () => {
      const media = await download({
        data: { base64: Buffer.from('BIN').toString('base64') },
      });

      expect(media.mimeType).toBe('application/octet-stream');
      expect(media.data.toString()).toBe('BIN');
    });

    it('sem mídia na resposta lança', async () => {
      await expect(download({ data: {} })).rejects.toThrow(/mídia/);
    });
  });

  it('Meta resolve a URL pelo id e baixa o binário com o token', async () => {
    const f = stubFetch(
      jsonRes({ url: 'https://cdn.meta/f', mime_type: 'audio/ogg' }),
      {
        ok: true,
        status: 200,
        arrayBuffer: () =>
          Promise.resolve(new TextEncoder().encode('OGG').buffer),
      },
    );
    const media = await new MetaProvider().use(meta).downloadMedia({
      providerMessageId: 'wamid.A',
      fromMe: false,
      raw: { audio: { id: 'MID' } },
    });

    expect(f.mock.calls[0][0]).toBe('https://graph.facebook.com/v21.0/MID');
    expect((f.mock.calls[1][1] as RequestInit).headers).toEqual({
      Authorization: 'Bearer a',
    });
    expect(media).toMatchObject({ mimeType: 'audio/ogg' });
    expect(media.data.toString()).toBe('OGG');
  });

  it('Meta usa o mediaRef gravado no envio quando existe', async () => {
    const f = stubFetch(
      jsonRes({ url: 'https://cdn.meta/f', mime_type: 'image/png' }),
      {
        ok: true,
        status: 200,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      },
    );
    await new MetaProvider().use(meta).downloadMedia({
      providerMessageId: 'x',
      fromMe: true,
      raw: { mediaRef: 'UP1' },
    });
    expect(f.mock.calls[0][0]).toBe('https://graph.facebook.com/v21.0/UP1');
  });

  it('Meta sem referência de mídia lança', async () => {
    await expect(
      new MetaProvider()
        .use(meta)
        .downloadMedia({ providerMessageId: 'x', fromMe: false, raw: {} }),
    ).rejects.toThrow(/referência/);
  });
});

describe('parseBaileysMessage', () => {
  it('lê legenda, mimetype e nome de arquivo sem exigir base64', () => {
    expect(
      parseBaileysMessage({
        documentMessage: {
          caption: 'nota',
          mimetype: 'application/pdf',
          fileName: 'n.pdf',
        },
      }),
    ).toEqual({
      type: 'DOCUMENT',
      text: 'nota',
      mimeType: 'application/pdf',
      fileName: 'n.pdf',
    });
  });

  it('figurinha é STICKER', () => {
    expect(
      parseBaileysMessage({ stickerMessage: { mimetype: 'image/webp' } }),
    ).toMatchObject({
      type: 'STICKER',
      mimeType: 'image/webp',
    });
  });

  it('desembrulha mensagem efêmera, visualização única e documento com legenda', () => {
    expect(
      parseBaileysMessage({
        ephemeralMessage: { message: { conversation: 'some' } },
      }),
    ).toMatchObject({ type: 'TEXT', text: 'some' });
    expect(
      parseBaileysMessage({
        viewOnceMessageV2: {
          message: { imageMessage: { mimetype: 'image/jpeg' } },
        },
      }),
    ).toMatchObject({ type: 'IMAGE' });
    expect(
      parseBaileysMessage({
        documentWithCaptionMessage: {
          message: { documentMessage: { fileName: 'a.pdf' } },
        },
      }),
    ).toMatchObject({ type: 'DOCUMENT', fileName: 'a.pdf' });
  });

  it('reação e revogação não viram mensagem', () => {
    expect(parseBaileysMessage({ reactionMessage: { text: '👍' } })).toBeNull();
    expect(parseBaileysMessage({ protocolMessage: { type: 0 } })).toBeNull();
  });

  it('o que não sabemos exibir vira UNSUPPORTED, não bolha vazia de texto', () => {
    expect(parseBaileysMessage({ locationMessage: {} })).toEqual({
      type: 'UNSUPPORTED',
    });
    expect(parseBaileysMessage(undefined)).toEqual({ type: 'UNSUPPORTED' });
  });
});
