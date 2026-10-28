import { Logger } from '@nestjs/common';
import { ContactProfileSyncService } from './contact-profile-sync.service';
import {
  EVO,
  META,
  realConnections,
  type ConnectionRow,
} from './test-utils/messaging-fixtures';

const okJson = (body: unknown) => ({
  ok: true,
  status: 200,
  statusText: 'OK',
  json: () => Promise.resolve(body),
});

function setup(rows: ConnectionRow[] = [EVO]) {
  const { service: connections } = realConnections(rows);
  const prisma = {
    messagingContact: {
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
    },
  };
  const events = { emit: vi.fn() };
  const service = new ContactProfileSyncService(
    prisma as never,
    connections,
    events as never,
  );
  return { service, prisma, events, connections };
}

describe('ContactProfileSyncService (nome e foto do contato)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const CONTACT_ID = 'contact-1';
  const PHONE_REF = '5534998956461';
  const contact = (over: object = {}) => ({
    id: CONTACT_ID,
    phone: PHONE_REF,
    pushName: null,
    profilePictureUrl: null,
    profileSyncedAt: null,
    ...over,
  });
  const evolutionProfile = (rows: unknown, picture?: unknown) =>
    vi
      .fn()
      .mockResolvedValueOnce(okJson(rows))
      .mockResolvedValue(okJson(picture ?? { profilePictureUrl: null }));
  const lastUpdate = (prisma: ReturnType<typeof setup>['prisma']) =>
    prisma.messagingContact.update.mock.calls.at(-1)![0];

  it('contato que só recebeu mensagem do celular ganha o nome (pushName) pelo provider', async () => {
    const { service, prisma, events } = setup();
    prisma.messagingContact.findUnique.mockResolvedValue(contact());
    vi.stubGlobal(
      'fetch',
      evolutionProfile([
        {
          pushName: 'Maria Silva',
          profilePicUrl: 'https://pps.whatsapp.net/a.jpg',
        },
      ]),
    );

    await service.sync(CONTACT_ID);

    expect(prisma.messagingContact.findUnique).toHaveBeenCalledWith({
      where: { id: CONTACT_ID },
    });
    expect(lastUpdate(prisma).data).toMatchObject({
      pushName: 'Maria Silva',
      profilePictureUrl: 'https://pps.whatsapp.net/a.jpg',
      profileSyncedAt: expect.any(Date),
    });
    expect(events.emit).toHaveBeenCalledWith({ type: 'contacts' });
  });

  it('não sobrescreve um nome que já existe', async () => {
    const { service, prisma } = setup();
    prisma.messagingContact.findUnique.mockResolvedValue(
      contact({ pushName: 'Nome atual' }),
    );
    vi.stubGlobal(
      'fetch',
      evolutionProfile([
        {
          pushName: 'Outro',
          profilePicUrl: 'https://pps.whatsapp.net/a.jpg',
        },
      ]),
    );
    await service.sync(CONTACT_ID);
    expect(lastUpdate(prisma).data).not.toHaveProperty('pushName');
  });

  it('sincronizado há menos de 24h não consulta o provider', async () => {
    const { service, prisma } = setup();
    prisma.messagingContact.findUnique.mockResolvedValue(
      contact({ profileSyncedAt: new Date() }),
    );
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    await service.sync(CONTACT_ID);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('force ignora o intervalo (URL da foto expirou)', async () => {
    const { service, prisma } = setup();
    prisma.messagingContact.findUnique.mockResolvedValue(
      contact({ profileSyncedAt: new Date() }),
    );
    vi.stubGlobal(
      'fetch',
      evolutionProfile([
        { profilePicUrl: 'https://pps.whatsapp.net/novo.jpg' },
      ]),
    );
    await service.sync(CONTACT_ID, true);
    expect(lastUpdate(prisma).data.profilePictureUrl).toBe(
      'https://pps.whatsapp.net/novo.jpg',
    );
  });

  it('sem foto no provider, limpa a URL antiga (a pessoa tirou a foto)', async () => {
    const { service, prisma } = setup();
    prisma.messagingContact.findUnique.mockResolvedValue(
      contact({ profilePictureUrl: 'https://pps.whatsapp.net/velha.jpg' }),
    );
    vi.stubGlobal(
      'fetch',
      evolutionProfile([{ pushName: 'Ana' }], { profilePictureUrl: null }),
    );
    await service.sync(CONTACT_ID, true);
    expect(lastUpdate(prisma).data.profilePictureUrl).toBeNull();
  });

  it('provider fora do ar: tenta de novo em ~10 minutos e NÃO apaga a foto que já temos', async () => {
    const { service, prisma, connections } = setup();
    prisma.messagingContact.findUnique.mockResolvedValue(
      contact({ profilePictureUrl: 'https://pps.whatsapp.net/atual.jpg' }),
    );
    // `_contactProfile` real engole erro de rede e devolve null; para testar o `failed` de
    // `sync` é preciso que a função de perfil em si rejeite.
    vi.spyOn(connections, 'use').mockReturnValue({
      contactProfile: () => Promise.reject(new Error('provider fora')),
    } as never);

    await service.sync(CONTACT_ID, true);

    const data = lastUpdate(prisma).data;
    expect(data).not.toHaveProperty('profilePictureUrl');
    const retryInMs =
      24 * 3600_000 - (Date.now() - data.profileSyncedAt.getTime());
    expect(retryInMs).toBeLessThan(11 * 60_000);
    expect(retryInMs).toBeGreaterThan(9 * 60_000);
  });

  it('contato inexistente é ignorado', async () => {
    const { service, prisma } = setup();
    await service.sync(CONTACT_ID);
    expect(prisma.messagingContact.update).not.toHaveBeenCalled();
  });

  it('Meta não expõe perfil: nenhuma conexão viva declara, nada é gravado', async () => {
    const { service, prisma } = setup([META]);
    prisma.messagingContact.findUnique.mockResolvedValue(contact());
    await service.sync(CONTACT_ID);
    expect(prisma.messagingContact.update).not.toHaveBeenCalled();
  });

  it('pickFetcher pula conexão com config inválida e loga em vez de propagar', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { service, prisma, connections } = setup();
    prisma.messagingContact.findUnique.mockResolvedValue(contact());
    vi.spyOn(connections, 'use').mockImplementation(() => {
      throw new Error('config inválida');
    });

    await service.sync(CONTACT_ID);

    expect(warn.mock.calls.some((c) => String(c[0]).includes('inválida ao procurar suporte a perfil'))).toBe(true);
    expect(prisma.messagingContact.update).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('syncQuietly nunca propaga — erro de sync vira warning', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { service, prisma } = setup();
    prisma.messagingContact.findUnique.mockRejectedValue(new Error('db fora'));

    service.syncQuietly(CONTACT_ID);

    await vi.waitFor(() =>
      expect(warn.mock.calls.some((c) => String(c[0]).includes(`Perfil ${CONTACT_ID} não sincronizado`))).toBe(true),
    );
    warn.mockRestore();
  });

  describe('segundo plano (lista de contatos)', () => {
    it('sem lista, não toca em nada', () => {
      const { service, prisma } = setup();
      service.syncInBackground([]);
      expect(prisma.messagingContact.findUnique).not.toHaveBeenCalled();
    });

    it('sincroniza um a um quem veio sem perfil', async () => {
      const { service, prisma } = setup();
      prisma.messagingContact.findUnique.mockResolvedValue(contact());
      vi.stubGlobal('fetch', evolutionProfile([{ pushName: 'Ana' }]));
      service.syncInBackground([CONTACT_ID]);
      await vi.waitFor(() =>
        expect(prisma.messagingContact.update).toHaveBeenCalled(),
      );
    });

    it('conexão sem perfil (Meta) é pulada sem ler o banco contato a contato', async () => {
      const { service, prisma } = setup([META]);
      service.syncInBackground(['contact-a', 'contact-b']);
      await new Promise((r) => setTimeout(r, 20));
      expect(prisma.messagingContact.findUnique).not.toHaveBeenCalled();
    });

    it('erro no meio da lista é logado e não escapa como rejeição não tratada', async () => {
      const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const { service, prisma } = setup();
      prisma.messagingContact.findUnique.mockRejectedValue(new Error('db fora'));

      service.syncInBackground([CONTACT_ID]);

      await vi.waitFor(() =>
        expect(warn.mock.calls.some((c) => String(c[0]).includes('Sincronização de perfis falhou'))).toBe(true),
      );
      warn.mockRestore();
    });
  });
});
