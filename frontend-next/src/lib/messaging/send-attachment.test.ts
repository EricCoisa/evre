import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendAttachment } from './send-attachment';

const file = new File(['abc'], 'foto.png', { type: 'image/png' });

function stubFetch(res: Partial<Response> & { json: () => Promise<unknown> }) {
  const fn = vi.fn().mockResolvedValue({ ok: true, status: 201, statusText: 'Created', ...res });
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('sendAttachment', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posta multipart no proxy, sem Content-Type manual', async () => {
    const fetchSpy = stubFetch({ json: () => Promise.resolve({ id: 'm1' }) });

    const result = await sendAttachment({ connectionId: 'conn-1', phone: '5511999990001', file, caption: 'olha' });

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/messaging/messages');
    expect(init.method).toBe('POST');
    expect(init.headers).toBeUndefined();
    const form = init.body as FormData;
    expect(form.get('connectionId')).toBe('conn-1');
    expect(form.get('phone')).toBe('5511999990001');
    expect(form.get('caption')).toBe('olha');
    expect((form.get('file') as File).name).toBe('foto.png');
    expect(form.has('type')).toBe(false);
    expect(result).toEqual({ id: 'm1' });
  });

  it('envia o type quando forçado', async () => {
    const fetchSpy = stubFetch({ json: () => Promise.resolve({ id: 'm1' }) });
    await sendAttachment({ connectionId: 'conn-1', phone: '1', file, type: 'DOCUMENT' });
    expect(((fetchSpy.mock.calls[0][1] as RequestInit).body as FormData).get('type')).toBe('DOCUMENT');
  });

  it('erro do backend vira Error com a mensagem dele', async () => {
    stubFetch({ ok: false, status: 400, json: () => Promise.resolve({ message: 'opt-out ativo' }) });
    await expect(sendAttachment({ connectionId: 'conn-1', phone: '1', file })).rejects.toThrow('opt-out ativo');
  });

  it('lista de mensagens de validação é juntada', async () => {
    stubFetch({ ok: false, status: 400, json: () => Promise.resolve({ message: ['a', 'b'] }) });
    await expect(sendAttachment({ connectionId: 'conn-1', phone: '1', file })).rejects.toThrow('a; b');
  });

  it('corpo que não é JSON cai no statusText', async () => {
    stubFetch({ ok: false, status: 502, statusText: 'Bad Gateway', json: () => Promise.reject(new Error('html')) });
    await expect(sendAttachment({ connectionId: 'conn-1', phone: '1', file })).rejects.toThrow('Bad Gateway');
  });
});
