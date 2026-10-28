import { EvolutionApiProvider } from './evolution-api.provider';

const cfg = { baseUrl: 'http://evo:8080', token: 'tok', instance: 'inst' };
const provider = () => new EvolutionApiProvider().use(cfg);

const res = (body: unknown, ok = true, status = 200) => ({
  ok,
  status,
  statusText: 'x',
  json: () => Promise.resolve(body),
});

function stubFetch(...responses: unknown[]) {
  const fn = vi.fn();
  responses.forEach((r) => fn.mockResolvedValueOnce(r));
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('Evolution API — perfil do contato', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('pega nome e foto do cadastro de contatos', async () => {
    const fetchSpy = stubFetch(
      res([
        {
          pushName: 'Maria Silva',
          profilePicUrl: 'https://pps.whatsapp.net/a.jpg',
        },
      ]),
    );

    expect(await provider().contactProfile!('5534998956461')).toEqual({
      pushName: 'Maria Silva',
      profilePictureUrl: 'https://pps.whatsapp.net/a.jpg',
    });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://evo:8080/chat/findContacts/inst');
    expect(JSON.parse(init.body as string)).toEqual({
      where: { remoteJid: '5534998956461@s.whatsapp.net' },
    });
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  // Contas antigas só existem para o WhatsApp pelo JID sem o 9.
  it('procura também a variante sem o 9 quando a canônica não acha', async () => {
    const fetchSpy = stubFetch(
      res([]),
      res([
        {
          pushName: 'Conta antiga',
          profilePicUrl: 'https://pps.whatsapp.net/b.jpg',
        },
      ]),
    );

    const profile = await provider().contactProfile!('5534998956461');

    expect(profile?.pushName).toBe('Conta antiga');
    expect(
      JSON.parse((fetchSpy.mock.calls[1][1] as RequestInit).body as string)
        .where.remoteJid,
    ).toBe('553498956461@s.whatsapp.net');
  });

  it('sem foto no cadastro, pergunta ao WhatsApp (fetchProfilePictureUrl)', async () => {
    const fetchSpy = stubFetch(
      res([{ pushName: 'Ana' }]),
      res([]),
      res({ profilePictureUrl: 'https://pps.whatsapp.net/c.jpg' }),
    );

    expect(await provider().contactProfile!('5534998956461')).toEqual({
      pushName: 'Ana',
      profilePictureUrl: 'https://pps.whatsapp.net/c.jpg',
    });
    expect(fetchSpy.mock.calls[2][0]).toBe(
      'http://evo:8080/chat/fetchProfilePictureUrl/inst',
    );
    expect(
      JSON.parse((fetchSpy.mock.calls[2][1] as RequestInit).body as string),
    ).toEqual({
      number: '5534998956461',
    });
  });

  it('perfil privado e contato desconhecido: sem nome nem foto vira null, não erro', async () => {
    stubFetch(res([]), res([]), res({ profilePictureUrl: null }));
    expect(await provider().contactProfile!('5534998956461')).toBeNull();
  });

  it('falha numa das consultas não derruba as outras', async () => {
    stubFetch(
      res({ message: 'boom' }, false, 500),
      res({ message: 'boom' }, false, 500),
      res({ profilePictureUrl: 'https://pps.whatsapp.net/d.jpg' }),
    );
    expect(await provider().contactProfile!('5534998956461')).toEqual({
      pushName: undefined,
      profilePictureUrl: 'https://pps.whatsapp.net/d.jpg',
    });
  });
});

describe('Evolution API — contacts.upsert/update por webhook', () => {
  const parse = (body: unknown) => provider().parseWebhook(body);
  const jid = (n: string) => `${n}@s.whatsapp.net`;

  it('lista de contatos vira um evento por contato com nome ou foto', () => {
    expect(
      parse({
        event: 'contacts.upsert',
        instance: 'inst',
        data: [
          {
            remoteJid: jid('553498956461'),
            pushName: 'Maria',
            profilePicUrl: 'https://pps.whatsapp.net/a.jpg',
          },
          { remoteJid: jid('5511987654321'), pushName: 'João' },
        ],
      }),
    ).toEqual([
      {
        kind: 'CONTACT',
        phone: '5534998956461',
        pushName: 'Maria',
        profilePictureUrl: 'https://pps.whatsapp.net/a.jpg',
      },
      {
        kind: 'CONTACT',
        phone: '5511987654321',
        pushName: 'João',
        profilePictureUrl: undefined,
      },
    ]);
  });

  it('contacts.update com um item só (objeto) também vale', () => {
    expect(
      parse({
        event: 'contacts.update',
        data: { remoteJid: jid('5511987654321'), pushName: 'João' },
      }),
    ).toHaveLength(1);
  });

  it('grupo, @lid e contato sem nome nem foto são ignorados', () => {
    expect(
      parse({
        event: 'contacts.upsert',
        data: [
          { remoteJid: '123@g.us', pushName: 'Grupo' },
          { remoteJid: '9999@lid', pushName: 'Opaco' },
          { remoteJid: jid('5511987654321') },
        ],
      }),
    ).toEqual([]);
  });

  it('contato de outra instância é descartado', () => {
    expect(
      parse({
        event: 'contacts.upsert',
        instance: 'de-outro-uso',
        data: [{ remoteJid: jid('5511987654321'), pushName: 'X' }],
      }),
    ).toEqual([]);
  });

  it('o webhook é registrado assinando os eventos de contato', async () => {
    const fetchSpy = stubFetch(
      res([{ name: 'inst', connectionStatus: 'open' }]),
      res({}),
    );
    await provider().registerWebhook('https://app/api/messaging/webhook');
    const webhook = JSON.parse(
      (fetchSpy.mock.calls[1][1] as RequestInit).body as string,
    ).webhook;
    expect(webhook.events).toEqual(
      expect.arrayContaining(['CONTACTS_UPSERT', 'CONTACTS_UPDATE']),
    );
  });
});
