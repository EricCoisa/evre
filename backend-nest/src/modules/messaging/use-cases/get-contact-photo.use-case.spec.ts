import { NotFoundException } from '@nestjs/common';
import {
  GetContactPhotoUseCase,
  isAllowedPhotoUrl,
} from './get-contact-photo.use-case';

const GOOD = 'https://pps.whatsapp.net/v/t61/photo.jpg';

describe('isAllowedPhotoUrl', () => {
  it.each([
    GOOD,
    'https://media-gru1-1.cdn.whatsapp.net/a.jpg',
    'https://scontent.xx.fbcdn.net/a.jpg',
  ])('aceita %s', (url) => expect(isAllowedPhotoUrl(url)).toBe(true));

  // A URL vem do provider e é gravada no banco: sem allowlist, vira SSRF.
  it.each([
    'http://pps.whatsapp.net/a.jpg',
    'https://localhost/a.jpg',
    'http://169.254.169.254/latest/meta-data',
    'https://whatsapp.net.evil.com/a.jpg',
    'https://evilwhatsapp.net/a.jpg',
    'file:///etc/passwd',
    'não é url',
  ])('recusa %s', (url) => expect(isAllowedPhotoUrl(url)).toBe(false));
});

describe('GetContactPhotoUseCase', () => {
  const prisma = { messagingContact: { findUnique: vi.fn() } };
  const profiles = { sync: vi.fn() };
  let useCase: GetContactPhotoUseCase;

  const image = (type = 'image/jpeg', bytes = 'JPG') =>
    new Response(bytes, { status: 200, headers: { 'content-type': type } });
  const fail = () => new Response(null, { status: 403 });

  beforeEach(() => {
    vi.clearAllMocks();
    profiles.sync.mockResolvedValue(undefined);
    useCase = new GetContactPhotoUseCase(
      prisma as never,
      profiles as never,
      { t: (k: string) => k } as never,
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('busca a foto na URL gravada, sem renovar', async () => {
    prisma.messagingContact.findUnique.mockResolvedValue({
      profilePictureUrl: GOOD,
    });
    const fetchSpy = vi.fn().mockImplementation(() => Promise.resolve(image()));
    vi.stubGlobal('fetch', fetchSpy);

    const photo = await useCase.execute('contact-1');

    expect(prisma.messagingContact.findUnique).toHaveBeenCalledWith({
      where: { id: 'contact-1' },
    });
    expect(photo).toMatchObject({ mimeType: 'image/jpeg' });
    expect(photo.data.toString()).toBe('JPG');
    expect(profiles.sync).not.toHaveBeenCalled();
  });

  it('URL expirada: pede uma nova ao provider (force) e tenta mais uma vez', async () => {
    prisma.messagingContact.findUnique
      .mockResolvedValueOnce({ id: 'contact-1', profilePictureUrl: GOOD })
      .mockResolvedValueOnce({
        profilePictureUrl: 'https://pps.whatsapp.net/novo.jpg',
      });
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(fail())
      .mockResolvedValueOnce(image());
    vi.stubGlobal('fetch', fetchSpy);

    await expect(useCase.execute('contact-1')).resolves.toMatchObject({
      mimeType: 'image/jpeg',
    });
    expect(profiles.sync).toHaveBeenCalledWith(
      'contact-1',
      true,
    );
    expect(fetchSpy.mock.calls[1][0]).toBe('https://pps.whatsapp.net/novo.jpg');
  });

  it('continua falhando depois de renovar: 404, sem tentar uma terceira vez', async () => {
    prisma.messagingContact.findUnique.mockResolvedValue({
      profilePictureUrl: GOOD,
    });
    const fetchSpy = vi.fn().mockImplementation(() => Promise.resolve(fail()));
    vi.stubGlobal('fetch', fetchSpy);

    await expect(useCase.execute('contact-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('contato sem foto é 404', async () => {
    prisma.messagingContact.findUnique.mockResolvedValue({
      profilePictureUrl: null,
    });
    vi.stubGlobal('fetch', vi.fn());
    await expect(useCase.execute('contact-1')).rejects.toThrow(
      'messaging.photo_not_found',
    );
  });

  it('URL fora da allowlist nunca é buscada, mesmo estando no banco', async () => {
    prisma.messagingContact.findUnique.mockResolvedValue({
      profilePictureUrl: 'http://169.254.169.254/latest/meta-data',
    });
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    await expect(useCase.execute('contact-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('resposta que não é imagem (HTML) é recusada', async () => {
    prisma.messagingContact.findUnique.mockResolvedValue({
      profilePictureUrl: GOOD,
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(image('text/html', '<script>')),
    );
    await expect(useCase.execute('contact-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('imagem acima de 2 MB é recusada', async () => {
    prisma.messagingContact.findUnique.mockResolvedValue({
      profilePictureUrl: GOOD,
    });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          image('image/jpeg', 'x'.repeat(2 * 1024 * 1024 + 1)),
        ),
    );
    await expect(useCase.execute('contact-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('falha ao renovar no provider vira 404, não 500', async () => {
    prisma.messagingContact.findUnique.mockResolvedValue({
      profilePictureUrl: GOOD,
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fail));
    profiles.sync.mockRejectedValue(
      new Error('provider fora'),
    );
    await expect(useCase.execute('contact-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
  describe('resposta suspeita', () => {
    const stored = () =>
      prisma.messagingContact.findUnique.mockResolvedValue({
        profilePictureUrl: GOOD,
      });

    it('redirect não é seguido: a allowlist valeria só para a primeira URL', async () => {
      stored();
      const fetchSpy = vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(null, {
            status: 302,
            headers: { location: 'http://169.254.169.254/' },
          }),
        ),
      );
      vi.stubGlobal('fetch', fetchSpy);

      await expect(useCase.execute('contact-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(fetchSpy.mock.calls[0][1]).toMatchObject({ redirect: 'manual' });
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('content-length acima do teto é recusado sem ler o corpo', async () => {
      stored();
      const fetchSpy = vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response('JPG', {
            headers: {
              'content-type': 'image/jpeg',
              'content-length': String(3 * 1024 * 1024),
            },
          }),
        ),
      );
      vi.stubGlobal('fetch', fetchSpy);
      await expect(useCase.execute('contact-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('corpo que passa do teto sem declarar o tamanho é cortado na leitura', async () => {
      stored();
      const big = new Uint8Array(2 * 1024 * 1024 + 1);
      const fetchSpy = vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(big, { headers: { 'content-type': 'image/jpeg' } }),
        ),
      );
      vi.stubGlobal('fetch', fetchSpy);
      await expect(useCase.execute('contact-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('a chamada leva prazo (AbortSignal)', async () => {
      stored();
      const fetchSpy = vi.fn().mockImplementation(() => Promise.resolve(image()));
      vi.stubGlobal('fetch', fetchSpy);
      await useCase.execute('contact-1');
      expect(fetchSpy.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    });
  });
});
