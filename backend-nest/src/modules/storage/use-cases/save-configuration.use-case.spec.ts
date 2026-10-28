import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { SaveStorageConfigurationUseCase } from './save-configuration.use-case';
import { StorageService } from '../storage.service';
import { SystemConfigurationService } from 'src/modules/system-configuration/system-configuration.service';
import type { SaveStorageConfigDto } from '../dto/save-storage-config.dto';

const mockStorageService = {
  validateCandidate: vi.fn(),
  invalidateHealthCache: vi.fn(),
};
const mockSysConfig = {
  keepStoredWhenBlank: vi.fn(),
  setManyByLabelKey: vi.fn(),
};

const s3Dto = {
  provider: 'S3',
  endpoint: 'http://localhost:9000',
  region: 'us-east-1',
  bucket: 'app-uploads',
  accessKey: 'nova-access',
  secretKey: 'nova-secret',
  publicUrl: 'http://localhost:9000/app-uploads',
} as SaveStorageConfigDto;

describe('SaveStorageConfigurationUseCase', () => {
  let useCase: SaveStorageConfigurationUseCase;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        SaveStorageConfigurationUseCase,
        { provide: StorageService, useValue: mockStorageService },
        { provide: SystemConfigurationService, useValue: mockSysConfig },
      ],
    }).compile();
    useCase = mod.get(SaveStorageConfigurationUseCase);
    vi.clearAllMocks();
    mockSysConfig.keepStoredWhenBlank.mockImplementation((value: string) =>
      Promise.resolve(value ?? ''),
    );
  });

  it('bucket inacessível: 400 e nada é gravado', async () => {
    mockStorageService.validateCandidate.mockResolvedValue({
      status: false,
      data: 'NoSuchBucket',
    });

    await expect(useCase.execute(s3Dto, 'admin-1')).rejects.toThrow(
      BadRequestException,
    );
    expect(mockSysConfig.setManyByLabelKey).not.toHaveBeenCalled();
  });

  it('S3 válido: grava as chaves do S3 e não as do LOCAL', async () => {
    mockStorageService.validateCandidate.mockResolvedValue({
      status: true,
      data: 'ok',
    });

    await useCase.execute(s3Dto, 'admin-1');

    const byKey = Object.fromEntries(
      (
        mockSysConfig.setManyByLabelKey.mock.calls[0][0] as Array<{
          labelKey: string;
          value: string;
        }>
      ).map((e) => [e.labelKey, e.value]),
    );
    expect(byKey).toMatchObject({
      SYSTEM_STORAGE_PROVIDER: 'S3',
      SYSTEM_STORAGE_S3_BUCKET: 'app-uploads',
      SYSTEM_STORAGE_S3_ACCESS_KEY: 'nova-access',
    });
    expect(byKey).not.toHaveProperty('SYSTEM_STORAGE_LOCAL_DIR');
    expect(mockStorageService.invalidateHealthCache).toHaveBeenCalled();
  });

  it('secretKey em branco: valida com a que já está guardada', async () => {
    mockSysConfig.keepStoredWhenBlank.mockResolvedValue('guardada');
    mockStorageService.validateCandidate.mockResolvedValue({
      status: true,
      data: 'ok',
    });

    await useCase.execute({ ...s3Dto, secretKey: '' }, 'admin-1');

    const candidate = mockStorageService.validateCandidate.mock
      .calls[0][0] as { s3: { secretKey: string } };
    expect(candidate.s3.secretKey).toBe('guardada');
  });
});
