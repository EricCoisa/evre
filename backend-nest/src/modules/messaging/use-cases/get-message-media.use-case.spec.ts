import { GetMessageMediaUseCase } from './get-message-media.use-case';

function setup(mimeType: string) {
  const messagingService = {
    downloadMedia: vi
      .fn()
      .mockResolvedValue({ data: Buffer.from('x'), mimeType }),
  };
  return new GetMessageMediaUseCase(messagingService as never);
}

describe('GetMessageMediaUseCase', () => {
  it.each([
    'image/png',
    'image/jpeg',
    'video/mp4',
    'audio/ogg; codecs=opus',
    'application/pdf',
  ])('%s sai inline com o mimetype original', async (mime) => {
    expect(await setup(mime).execute('m')).toMatchObject({
      inline: true,
      mimeType: mime,
    });
  });

  // O mimetype vem do remetente: servido como veio, HTML/SVG executaria no domínio do painel.
  it.each([
    'text/html',
    'image/svg+xml',
    'application/javascript',
    'application/zip',
  ])('%s é rebaixado para download', async (mime) => {
    expect(await setup(mime).execute('m')).toMatchObject({
      inline: false,
      mimeType: 'application/octet-stream',
    });
  });
});
