import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { StorageService } from './storage.service';
import { S3StorageService } from './providers/s3-storage.service';
import { LocalStorageService } from './providers/local-storage.service';
import { SystemConfigurationService } from 'src/modules/system-configuration/system-configuration.service';
import { RedisService } from 'src/common/infrastructure/redis/redis.service';

const makeMockProvider = () => ({
  upload: vi.fn().mockResolvedValue('avatars/u1.jpg'),
  delete: vi.fn().mockResolvedValue(undefined),
  getPublicUrl: vi.fn((key: string) => `http://s3/bucket/${key}`),
  validateConfiguration: vi
    .fn()
    .mockResolvedValue({ status: true, data: 'ok' }),
});

const mockS3Use = vi.fn();
const mockLocalUse = vi.fn();

const mockSysConfig = { findByLabelKey: vi.fn() };

const mockRedis = {
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(undefined),
  del: vi.fn().mockResolvedValue(undefined),
};

describe('StorageService (facade)', () => {
  let service: StorageService;
  let s3Provider: ReturnType<typeof makeMockProvider>;
  let localProvider: ReturnType<typeof makeMockProvider>;

  beforeEach(async () => {
    s3Provider = makeMockProvider();
    localProvider = makeMockProvider();
    mockS3Use.mockReturnValue(s3Provider);
    mockLocalUse.mockReturnValue(localProvider);
    mockSysConfig.findByLabelKey.mockReset();

    const module = await Test.createTestingModule({
      providers: [
        StorageService,
        { provide: S3StorageService, useValue: { use: mockS3Use } },
        { provide: LocalStorageService, useValue: { use: mockLocalUse } },
        { provide: SystemConfigurationService, useValue: mockSysConfig },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    service = module.get(StorageService);
  });

  describe('when SYSTEM_STORAGE_PROVIDER = S3 (or missing)', () => {
    beforeEach(() => {
      mockSysConfig.findByLabelKey.mockImplementation((key: string) => {
        if (key === 'SYSTEM_STORAGE_PROVIDER') return { value: 'S3' };
        return { value: '' };
      });
    });

    it('upload delegates to S3 provider', async () => {
      await service.upload('avatars/u1.jpg', Buffer.from('x'), 'image/jpeg');
      expect(mockS3Use).toHaveBeenCalled();
      expect(s3Provider.upload).toHaveBeenCalledWith(
        'avatars/u1.jpg',
        expect.any(Buffer),
        'image/jpeg',
      );
    });

    it('getPublicUrl is async and returns string', async () => {
      s3Provider.getPublicUrl.mockReturnValue(
        'http://s3/bucket/avatars/u1.jpg',
      );
      const url = await service.getPublicUrl('avatars/u1.jpg');
      expect(url).toBe('http://s3/bucket/avatars/u1.jpg');
    });

    it('delete delegates to S3 provider', async () => {
      await service.delete('avatars/u1.jpg');
      expect(s3Provider.delete).toHaveBeenCalledWith('avatars/u1.jpg');
    });

    it('getPresignedUrl delegates to the active provider with the ttl', async () => {
      (s3Provider as unknown as { getPresignedUrl: ReturnType<typeof vi.fn> })
        .getPresignedUrl = vi.fn().mockResolvedValue('http://s3/signed');

      const url = await service.getPresignedUrl('avatars/u1.jpg', 120);

      expect(url).toBe('http://s3/signed');
      expect(
        (s3Provider as unknown as { getPresignedUrl: ReturnType<typeof vi.fn> })
          .getPresignedUrl,
      ).toHaveBeenCalledWith('avatars/u1.jpg', 120);
    });
  });

  describe('when SYSTEM_STORAGE_PROVIDER = LOCAL', () => {
    beforeEach(() => {
      mockSysConfig.findByLabelKey.mockImplementation((key: string) => {
        if (key === 'SYSTEM_STORAGE_PROVIDER') return { value: 'LOCAL' };
        return { value: '' };
      });
    });

    it('upload delegates to local provider', async () => {
      await service.upload('avatars/u1.jpg', Buffer.from('x'), 'image/jpeg');
      expect(mockLocalUse).toHaveBeenCalled();
      expect(localProvider.upload).toHaveBeenCalled();
    });
  });

  describe('when SYSTEM_STORAGE_PROVIDER key is missing (NotFoundException)', () => {
    beforeEach(() => {
      mockSysConfig.findByLabelKey.mockRejectedValue(new NotFoundException());
    });

    it('falls back to S3 provider', async () => {
      await service.upload('avatars/u1.jpg', Buffer.from('x'), 'image/jpeg');
      expect(mockS3Use).toHaveBeenCalled();
    });
  });

  describe('resolveKeyFromUrl', () => {
    beforeEach(() => {
      // provider() resolve para S3; o mock getPublicUrl('') => 'http://s3/bucket/'
      mockSysConfig.findByLabelKey.mockResolvedValue({ value: 'S3' });
    });

    it('strips the provider public prefix to recover the key', async () => {
      expect(
        await service.resolveKeyFromUrl('http://s3/bucket/avatars/u1.jpg'),
      ).toBe('avatars/u1.jpg');
    });

    it('returns null when the url does not start with the provider prefix', async () => {
      expect(
        await service.resolveKeyFromUrl('http://other/x/avatars/u1.jpg'),
      ).toBeNull();
    });

    it('returns null for null input', async () => {
      expect(await service.resolveKeyFromUrl(null)).toBeNull();
    });
  });

  describe('resolveFileFromUrl', () => {
    beforeEach(() => {
      // Ativo = LOCAL, mas a URL pode pertencer ao S3 (provider antigo) — ambos
      // ficam configurados o tempo todo, então precisa checar os dois.
      mockSysConfig.findByLabelKey.mockImplementation((key: string) => {
        if (key === 'SYSTEM_STORAGE_PROVIDER') return { value: 'LOCAL' };
        return { value: '' };
      });
      s3Provider.getPublicUrl.mockImplementation(
        (key: string) => `http://s3/bucket/${key}`,
      );
      localProvider.getPublicUrl.mockImplementation(
        (key: string) => `http://local/uploads/${key}`,
      );
    });

    it('resolves a URL belonging to the inactive provider (S3, while LOCAL is active)', async () => {
      const result = await service.resolveFileFromUrl(
        'http://s3/bucket/avatars/u1.jpg',
      );
      expect(result).toEqual({ provider: s3Provider, key: 'avatars/u1.jpg' });
    });

    it('resolves a URL belonging to the active provider (LOCAL)', async () => {
      const result = await service.resolveFileFromUrl(
        'http://local/uploads/avatars/u1.jpg',
      );
      expect(result).toEqual({
        provider: localProvider,
        key: 'avatars/u1.jpg',
      });
    });

    it('returns null when the url matches neither provider', async () => {
      expect(
        await service.resolveFileFromUrl('http://other/x/avatars/u1.jpg'),
      ).toBeNull();
    });

    it('returns null for null input', async () => {
      expect(await service.resolveFileFromUrl(null)).toBeNull();
    });
  });

  describe('checkHealth', () => {
    beforeEach(() => {
      mockSysConfig.findByLabelKey.mockImplementation((key: string) => {
        if (key === 'SYSTEM_STORAGE_PROVIDER') return { value: 'S3' };
        return { value: '' };
      });
      vi.clearAllMocks();
    });

    it('cache hit: returns cached result without calling validateConfiguration', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ operational: true }));

      const result = await service.checkHealth();

      expect(result).toEqual({ operational: true });
      expect(mockRedis.set).not.toHaveBeenCalled();
      expect(s3Provider.validateConfiguration).not.toHaveBeenCalled();
    });

    it('cache miss: calls validateConfiguration, writes to cache and returns result', async () => {
      mockRedis.get.mockResolvedValue(null);
      s3Provider.validateConfiguration.mockResolvedValue({
        status: true,
        data: 'ok',
      });

      const result = await service.checkHealth();

      expect(result).toEqual({ operational: true });
      expect(s3Provider.validateConfiguration).toHaveBeenCalledTimes(1);
      expect(mockRedis.set).toHaveBeenCalledWith(
        'storage:health',
        JSON.stringify({ operational: true }),
        300,
      );
    });

    it('cache miss with failing provider: returns operational=false with reason', async () => {
      mockRedis.get.mockResolvedValue(null);
      s3Provider.validateConfiguration.mockResolvedValue({
        status: false,
        data: 'bucket not accessible',
      });

      const result = await service.checkHealth();

      expect(result).toEqual({
        operational: false,
        reason: 'bucket not accessible',
      });
      expect(mockRedis.set).toHaveBeenCalledWith(
        'storage:health',
        JSON.stringify({
          operational: false,
          reason: 'bucket not accessible',
        }),
        300,
      );
    });
  });

  describe('invalidateHealthCache', () => {
    it('deletes the health cache key', async () => {
      await service.invalidateHealthCache();
      expect(mockRedis.del).toHaveBeenCalledWith('storage:health');
    });
  });

  describe('validateCandidate', () => {
    it('valida credenciais candidatas de S3, ainda não gravadas', async () => {
      s3Provider.validateConfiguration.mockResolvedValue({ status: true, data: 'ok' });

      const result = await service.validateCandidate({
        provider: 'S3',
        s3: { bucket: 'b' } as never,
      });

      expect(mockS3Use).toHaveBeenCalled();
      expect(result).toEqual({ status: true, data: 'ok' });
    });

    it('valida credenciais candidatas de LOCAL, ainda não gravadas', async () => {
      localProvider.validateConfiguration.mockResolvedValue({ status: true, data: 'ok' });

      const result = await service.validateCandidate({
        provider: 'LOCAL',
        local: { dir: './x' } as never,
      });

      expect(mockLocalUse).toHaveBeenCalled();
      expect(result).toEqual({ status: true, data: 'ok' });
    });

    it('devolve status=false quando o provider rejeita a candidata', async () => {
      s3Provider.validateConfiguration.mockRejectedValue(new Error('bad creds'));

      const result = await service.validateCandidate({
        provider: 'S3',
        s3: { bucket: 'b' } as never,
      });

      expect(result).toEqual({ status: false, data: 'bad creds' });
    });
  });

  describe('getLocalStorageDir', () => {
    it('resolve o diretório LOCAL configurado', async () => {
      mockSysConfig.findByLabelKey.mockImplementation((key: string) =>
        key === 'SYSTEM_STORAGE_LOCAL_DIR' ? { value: './meus-uploads' } : { value: '' },
      );

      await expect(service.getLocalStorageDir()).resolves.toBe('./meus-uploads');
    });
  });

  describe('fallback de config ausente (nem SystemConfiguration, nem env)', () => {
    const envBackup: Record<string, string | undefined> = {};
    const ENV_KEYS = [
      'S3_ENDPOINT',
      'S3_REGION',
      'S3_BUCKET',
      'S3_ACCESS_KEY',
      'S3_SECRET_KEY',
      'S3_PUBLIC_URL',
      'STORAGE_LOCAL_DIR',
      'STORAGE_PUBLIC_BASE_URL',
    ];

    beforeEach(() => {
      for (const k of ENV_KEYS) {
        envBackup[k] = process.env[k];
        delete process.env[k];
      }
      mockSysConfig.findByLabelKey.mockResolvedValue(null);
    });

    afterEach(() => {
      for (const k of ENV_KEYS) {
        if (envBackup[k] === undefined) delete process.env[k];
        else process.env[k] = envBackup[k];
      }
    });

    it('S3 sem config nem env usa os defaults embutidos', async () => {
      mockSysConfig.findByLabelKey.mockImplementation((key: string) =>
        key === 'SYSTEM_STORAGE_PROVIDER' ? { value: 'S3' } : null,
      );

      await service.upload('k', Buffer.from('x'), 'image/jpeg');

      expect(mockS3Use).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: 'http://localhost:8333',
          region: 'us-east-1',
          bucket: 'app-uploads',
          accessKey: '',
          secretKey: '',
          publicUrl: 'http://localhost:8333/app-uploads',
        }),
      );
    });

    it('LOCAL sem config nem env usa os defaults embutidos', async () => {
      mockSysConfig.findByLabelKey.mockImplementation((key: string) =>
        key === 'SYSTEM_STORAGE_PROVIDER' ? { value: 'LOCAL' } : null,
      );

      await service.upload('k', Buffer.from('x'), 'image/jpeg');

      expect(mockLocalUse).toHaveBeenCalledWith(
        expect.objectContaining({
          dir: './uploads',
          baseUrl: 'http://localhost:3001',
        }),
      );
    });
  });

  describe('buildKey', () => {
    it('monta prefixo/uuid.ext', () => {
      const key = service.buildKey('avatars', 'jpg');
      expect(key).toMatch(/^test-app\/avatars\/[0-9a-f-]{36}\.jpg$/);
    });
  });

  describe('readConfigValue — erro real propaga', () => {
    it('erro que não é NotFoundException propaga em vez de virar "sem valor"', async () => {
      mockSysConfig.findByLabelKey.mockRejectedValue(new Error('db fora'));

      await expect(service.validateConfiguration()).rejects.toThrow('db fora');
    });
  });
});
