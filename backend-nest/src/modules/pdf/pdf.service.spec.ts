import { Test } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { PdfService } from './pdf.service';
import { RedisService } from 'src/common/infrastructure/redis/redis.service';

const mockRedis = {
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(undefined),
  del: vi.fn().mockResolvedValue(undefined),
};

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('PdfService', () => {
  let service: PdfService;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    const module = await Test.createTestingModule({
      providers: [
        PdfService,
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();
    service = module.get(PdfService);
  });

  describe('generate', () => {
    it('gera PDF sem opções e retorna Buffer', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)),
      });

      const result = await service.generate('<html></html>');

      expect(result).toBeInstanceOf(Buffer);
      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, opts] = mockFetch.mock.calls[0] as [string, { method: string; body: FormData }];
      expect(url).toContain('/forms/chromium/convert/html');
      expect(opts.method).toBe('POST');
    });

    it('gera PDF com landscape (appenda paperWidth/paperHeight)', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)),
      });

      await service.generate('<html></html>', { orientation: 'landscape' });

      const [, opts] = mockFetch.mock.calls[0] as [string, { body: FormData }];
      expect((opts.body as FormData).get('landscape')).toBe('true');
      expect((opts.body as FormData).get('paperWidth')).toBe('11.69');
      expect((opts.body as FormData).get('paperHeight')).toBe('8.27');
    });

    it('gera PDF com margens (appenda marginTop etc)', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)),
      });

      await service.generate('<html></html>', {
        marginTop: '1cm',
        marginBottom: '2cm',
        marginLeft: '3cm',
        marginRight: '4cm',
      });

      const [, opts] = mockFetch.mock.calls[0] as [string, { body: FormData }];
      expect((opts.body as FormData).get('marginTop')).toBe('1cm');
      expect((opts.body as FormData).get('marginBottom')).toBe('2cm');
      expect((opts.body as FormData).get('marginLeft')).toBe('3cm');
      expect((opts.body as FormData).get('marginRight')).toBe('4cm');
    });

    it('fetch rejeita → ServiceUnavailableException', async () => {
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(service.generate('<html></html>')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('resposta !ok → ServiceUnavailableException', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500 });

      await expect(service.generate('<html></html>')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('checkHealth', () => {
    it('cache hit → retorna valor cacheado sem chamar fetch', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ operational: true }));

      const result = await service.checkHealth();

      expect(result).toEqual({ operational: true });
      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it('cache miss + gotenberg up → { operational: true } + salva no redis', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'up' }),
      });

      const result = await service.checkHealth();

      expect(result).toEqual({ operational: true });
      expect(mockRedis.set).toHaveBeenCalledWith(
        'pdf:health',
        JSON.stringify({ operational: true }),
        300,
      );
    });

    it('cache miss + gotenberg retorna status != "up" → { operational: false }', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 'down' }),
      });

      const result = await service.checkHealth();

      expect(result.operational).toBe(false);
    });

    it('cache miss + fetch rejeita → { operational: false, reason }', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await service.checkHealth();

      expect(result.operational).toBe(false);
      expect(result.reason).toContain('ECONNREFUSED');
    });
  });

  describe('invalidateHealthCache', () => {
    it('chama redis.del com a chave correta', async () => {
      await service.invalidateHealthCache();

      expect(mockRedis.del).toHaveBeenCalledWith('pdf:health');
    });
  });
});
