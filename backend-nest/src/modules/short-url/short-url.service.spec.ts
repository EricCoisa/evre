import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../prisma/prisma.service';
import { ShortUrlService } from './short-url.service';
import { ShortenUrlUseCase } from './use-cases/shorten-url.use-case';
import { DeactivateShortUrlUseCase } from './use-cases/deactivate-short-url.use-case';

const mockPrisma = {
  shortLink: { findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
};
const mockI18n = { t: vi.fn((key: string) => key) };

describe('ShortUrlService.buildShortUrl', () => {
  let service: ShortUrlService;
  let configGet: ReturnType<typeof vi.fn>;
  const originalNextAuthUrl = process.env.NEXTAUTH_URL;

  beforeEach(async () => {
    configGet = vi.fn();
    delete process.env.NEXTAUTH_URL;
    const module = await Test.createTestingModule({
      providers: [
        ShortUrlService,
        ShortenUrlUseCase,
        DeactivateShortUrlUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: { get: configGet } },
        { provide: I18nService, useValue: mockI18n },
      ],
    }).compile();
    service = module.get(ShortUrlService);
  });

  afterEach(() => {
    process.env.NEXTAUTH_URL = originalNextAuthUrl;
  });

  // Regressão: mesma cadeia que o código tinha triplicado antes de virar método único da facade —
  // ver docs/backend/use-cases.md.
  it('usa SHORT_URL_BASE_URL quando configurado', () => {
    configGet.mockImplementation((key: string) =>
      key === 'SHORT_URL_BASE_URL' ? 'https://short.example.com' : undefined,
    );

    expect(service.buildShortUrl('abc123')).toBe(
      'https://short.example.com/s/abc123',
    );
  });

  it('cai para FRONTEND_URL sem SHORT_URL_BASE_URL', () => {
    configGet.mockImplementation((key: string) =>
      key === 'FRONTEND_URL' ? 'https://app.example.com' : undefined,
    );

    expect(service.buildShortUrl('abc123')).toBe(
      'https://app.example.com/s/abc123',
    );
  });

  it('cai para NEXTAUTH_URL sem SHORT_URL_BASE_URL nem FRONTEND_URL', () => {
    configGet.mockReturnValue(undefined);
    process.env.NEXTAUTH_URL = 'https://auth.example.com';

    expect(service.buildShortUrl('abc123')).toBe(
      'https://auth.example.com/s/abc123',
    );
  });

  it('cai para localhost sem nenhuma env configurada', () => {
    configGet.mockReturnValue(undefined);

    expect(service.buildShortUrl('abc123')).toBe(
      'http://localhost:3000/s/abc123',
    );
  });

  it('remove barra final da base antes de montar a URL', () => {
    configGet.mockImplementation((key: string) =>
      key === 'SHORT_URL_BASE_URL' ? 'https://short.example.com/' : undefined,
    );

    expect(service.buildShortUrl('abc123')).toBe(
      'https://short.example.com/s/abc123',
    );
  });
});
