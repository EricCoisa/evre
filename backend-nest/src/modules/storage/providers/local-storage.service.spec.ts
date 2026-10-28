import { Test } from '@nestjs/testing';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { LocalStorageService } from './local-storage.service';
import type { LocalConfigDto } from '../dto/local-config.dto';

const mockMkdir = vi.hoisted(() => vi.fn());
vi.mock('fs/promises', async (importOriginal) => {
  const real = await importOriginal<typeof import('fs/promises')>();
  mockMkdir.mockImplementation(real.mkdir);
  return { ...real, mkdir: mockMkdir };
});

describe('LocalStorageService', () => {
  let service: LocalStorageService;
  let tmpDir: string;
  let cfg: LocalConfigDto;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'local-storage-spec-'));
    cfg = { dir: tmpDir, baseUrl: 'http://localhost:3000' };

    const module = await Test.createTestingModule({
      providers: [LocalStorageService],
    }).compile();
    service = module.get(LocalStorageService);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('upload — writes file and returns key', async () => {
    const provider = service.use(cfg);
    const key = await provider.upload(
      'avatars/u1.jpg',
      Buffer.from('img-data'),
      'image/jpeg',
    );
    expect(key).toBe('avatars/u1.jpg');
    const content = await fs.readFile(path.join(tmpDir, 'avatars/u1.jpg'));
    expect(content.toString()).toBe('img-data');
  });

  it('upload — creates nested directories', async () => {
    const provider = service.use(cfg);
    await provider.upload(
      'deep/nested/file.png',
      Buffer.from('x'),
      'image/png',
    );
    await expect(
      fs.access(path.join(tmpDir, 'deep/nested/file.png')),
    ).resolves.toBeUndefined();
  });

  it('delete — removes existing file', async () => {
    const provider = service.use(cfg);
    await provider.upload('avatars/del.jpg', Buffer.from('x'), 'image/jpeg');
    await provider.delete('avatars/del.jpg');
    await expect(
      fs.access(path.join(tmpDir, 'avatars/del.jpg')),
    ).rejects.toThrow();
  });

  it('delete — swallows missing file error', async () => {
    const provider = service.use(cfg);
    await expect(
      provider.delete('does-not-exist.jpg'),
    ).resolves.toBeUndefined();
  });

  it('getPresignedUrl — same as getPublicUrl, local storage has no signing', async () => {
    const provider = service.use(cfg);
    await expect(provider.getPresignedUrl('avatars/u1.jpg')).resolves.toBe(
      'http://localhost:3000/uploads/avatars/u1.jpg',
    );
  });

  it('getPublicUrl — returns baseUrl/uploads/key', () => {
    const provider = service.use(cfg);
    expect(provider.getPublicUrl('avatars/u1.jpg')).toBe(
      'http://localhost:3000/uploads/avatars/u1.jpg',
    );
  });

  it('validateConfiguration — returns status:true for writable dir', async () => {
    const provider = service.use(cfg);
    const res = await provider.validateConfiguration();
    expect(res.status).toBe(true);
  });

  it('validateConfiguration — returns status:false when dir is not writable', async () => {
    // Use a path that doesn't exist and can't be created to simulate failure
    const badCfg = { dir: '\0invalid', baseUrl: 'http://localhost:3000' };
    const provider = service.use(badCfg);
    const res = await provider.validateConfiguration();
    expect(res.status).toBe(false);
  });

  it('validateConfiguration — rejeição que não é Error ainda vira uma mensagem', async () => {
    mockMkdir.mockRejectedValueOnce('disk full');
    const provider = service.use(cfg);
    const res = await provider.validateConfiguration();
    expect(res).toEqual({ status: false, data: 'disk full' });
  });
});
