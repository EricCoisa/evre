import { Test } from '@nestjs/testing';
import { S3StorageService } from './s3-storage.service';
import type { S3ConfigDto } from '../dto/s3-config.dto';

const mockSend = vi.fn();
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({ send: mockSend })),
  PutObjectCommand: vi.fn().mockImplementation((input) => ({ input })),
  DeleteObjectCommand: vi.fn().mockImplementation((input) => ({ input })),
  HeadBucketCommand: vi.fn().mockImplementation((input) => ({ input })),
  GetObjectCommand: vi.fn().mockImplementation((input) => ({ input })),
}));

const mockGetSignedUrl = vi.hoisted(() => vi.fn());
vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: mockGetSignedUrl,
}));

const cfg: S3ConfigDto = {
  endpoint: 'http://localhost:9000',
  region: 'us-east-1',
  bucket: 'test-bucket',
  accessKey: 'key',
  secretKey: 'secret',
  publicUrl: 'http://localhost:9000/test-bucket',
};

describe('S3StorageService', () => {
  let service: S3StorageService;

  beforeEach(async () => {
    mockSend.mockReset();
    mockGetSignedUrl.mockReset();
    const module = await Test.createTestingModule({
      providers: [S3StorageService],
    }).compile();
    service = module.get(S3StorageService);
  });

  it('upload — sends PutObjectCommand and returns key', async () => {
    mockSend.mockResolvedValueOnce({});
    const provider = service.use(cfg);
    const result = await provider.upload(
      'avatars/u1.jpg',
      Buffer.from('data'),
      'image/jpeg',
    );
    expect(result).toBe('avatars/u1.jpg');
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('delete — sends DeleteObjectCommand', async () => {
    mockSend.mockResolvedValueOnce({});
    const provider = service.use(cfg);
    await provider.delete('avatars/u1.jpg');
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('delete — swallows error and logs warn', async () => {
    mockSend.mockRejectedValueOnce(new Error('NoSuchKey'));
    const provider = service.use(cfg);
    await expect(provider.delete('avatars/x.jpg')).resolves.toBeUndefined();
  });

  it('getPresignedUrl — assina via s3-request-presigner com o ttl pedido', async () => {
    mockGetSignedUrl.mockResolvedValue('http://localhost:9000/test-bucket/signed');
    const provider = service.use(cfg);

    const url = await provider.getPresignedUrl('avatars/u1.jpg', 120);

    expect(url).toBe('http://localhost:9000/test-bucket/signed');
    expect(mockGetSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { expiresIn: 120 },
    );
  });

  it('getPresignedUrl — ttl padrão de 3600s quando não informado', async () => {
    mockGetSignedUrl.mockResolvedValue('http://signed');
    const provider = service.use(cfg);

    await provider.getPresignedUrl('avatars/u1.jpg');

    expect(mockGetSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { expiresIn: 3600 },
    );
  });

  it('getPublicUrl — returns sync URL', () => {
    const provider = service.use(cfg);
    expect(provider.getPublicUrl('avatars/u1.jpg')).toBe(
      'http://localhost:9000/test-bucket/avatars/u1.jpg',
    );
  });

  it('validateConfiguration — returns status:true on HeadBucket success', async () => {
    mockSend.mockResolvedValueOnce({});
    const provider = service.use(cfg);
    const res = await provider.validateConfiguration();
    expect(res.status).toBe(true);
  });

  it('validateConfiguration — returns status:false on HeadBucket failure', async () => {
    mockSend.mockRejectedValueOnce(new Error('NoSuchBucket'));
    const provider = service.use(cfg);
    const res = await provider.validateConfiguration();
    expect(res.status).toBe(false);
    expect(res.data).toContain('NoSuchBucket');
  });

  it('validateConfiguration — rejeição que não é Error ainda vira uma mensagem', async () => {
    mockSend.mockRejectedValueOnce('bucket unreachable');
    const provider = service.use(cfg);
    const res = await provider.validateConfiguration();
    expect(res).toEqual({ status: false, data: 'bucket unreachable' });
  });
});
