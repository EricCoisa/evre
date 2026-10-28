import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { UpdateProfileUseCase } from './update-profile.use-case';
import { PrismaService } from '../../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { StorageService } from '../../storage/storage.service';

const mockPrisma = {
  user: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
};

const mockI18n = { t: vi.fn((k: string) => k) };

const mockStorage = {
  upload: vi.fn().mockResolvedValue('avatars/u1.jpg'),
  delete: vi.fn().mockResolvedValue(undefined),
  getPublicUrl: vi
    .fn()
    .mockResolvedValue('http://localhost:9000/app-uploads/avatars/u1.jpg'),
  resolveKeyFromUrl: vi.fn().mockResolvedValue('avatars/old.jpg'),
  buildKey: vi.fn().mockReturnValue('avatars/u1.jpg'),
};

const fakeUser = {
  id: 'u1',
  email: 'test@example.com',
  name: 'Test User',
  role: 'USER',
  status: 'ACTIVE',
  imageUrl: null as string | null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const jpeg = () => Buffer.from([0xff, 0xd8, 0xff]);

describe('UpdateProfileUseCase', () => {
  let useCase: UpdateProfileUseCase;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateProfileUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: I18nService, useValue: mockI18n },
        { provide: StorageService, useValue: mockStorage },
      ],
    }).compile();
    useCase = module.get(UpdateProfileUseCase);
    mockPrisma.user.findUnique.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockStorage.upload.mockResolvedValue('avatars/u1.jpg');
    mockStorage.getPublicUrl.mockResolvedValue(
      'http://localhost:9000/app-uploads/avatars/u1.jpg',
    );
    mockStorage.resolveKeyFromUrl.mockResolvedValue('avatars/old.jpg');
  });

  it('throws NotFoundException when user not found', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    await expect(useCase.execute('missing', { name: 'New' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws BadRequestException for non-Buffer image', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(fakeUser);
    await expect(
      useCase.execute('u1', { name: 'New', image: 'not-a-buffer' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException for empty image buffer', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(fakeUser);
    await expect(
      useCase.execute('u1', { name: 'New', image: Buffer.alloc(0) }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException for image exceeding 5MB', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(fakeUser);
    await expect(
      useCase.execute('u1', {
        name: 'New',
        image: Buffer.alloc(6 * 1024 * 1024),
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException for unsupported content-type', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(fakeUser);
    await expect(
      useCase.execute('u1', {
        image: Buffer.from([1, 2, 3]),
        contentType: 'image/gif',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('uploads image and saves the resolved public URL', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(fakeUser);
    mockPrisma.user.update.mockResolvedValue({
      ...fakeUser,
      imageUrl: 'http://localhost:9000/app-uploads/avatars/u1.jpg',
    });
    const result = await useCase.execute('u1', {
      name: 'New Name',
      image: jpeg(),
      contentType: 'image/jpeg',
    });
    expect(mockStorage.upload).toHaveBeenCalledWith(
      'avatars/u1.jpg',
      expect.any(Buffer),
      'image/jpeg',
    );
    expect(mockStorage.getPublicUrl).toHaveBeenCalledWith('avatars/u1.jpg');
    expect(result).toHaveProperty('imageUrl');
  });

  it('clears imageUrl when null is passed', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(fakeUser);
    mockPrisma.user.update.mockResolvedValue({ ...fakeUser, imageUrl: null });
    const result = await useCase.execute('u1', {
      name: 'New Name',
      image: null,
    });
    expect(result).toBeDefined();
    expect(mockStorage.upload).not.toHaveBeenCalled();
  });

  it('atualiza phone quando informado', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(fakeUser);
    mockPrisma.user.update.mockResolvedValue({ ...fakeUser, phone: '+5511999998888' });
    await useCase.execute('u1', { name: 'New Name', phone: '+5511999998888' });
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ phone: '+5511999998888' }) }),
    );
  });

  it('rejeita phone já usado por outro usuário', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(fakeUser);
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u2', phone: '+5511999998888' });
    await expect(
      useCase.execute('u1', { phone: '+5511999998888' }),
    ).rejects.toThrow(ConflictException);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it('permite manter o próprio phone atual', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ ...fakeUser, phone: '+5511999998888' });
    mockPrisma.user.update.mockResolvedValue({ ...fakeUser, phone: '+5511999998888' });
    await useCase.execute('u1', { phone: '+5511999998888' });
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.user.update).toHaveBeenCalled();
  });

  it('mantém o phone existente quando não informado', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ ...fakeUser, phone: '+5511999998888' });
    mockPrisma.user.update.mockResolvedValue(fakeUser);
    await useCase.execute('u1', { name: 'New Name' });
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ phone: '+5511999998888' }) }),
    );
  });

  it('keeps existing imageUrl when image is undefined', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(fakeUser);
    mockPrisma.user.update.mockResolvedValue(fakeUser);
    await useCase.execute('u1', { name: 'New Name' });
    expect(mockPrisma.user.update).toHaveBeenCalled();
    expect(mockStorage.upload).not.toHaveBeenCalled();
  });

  it('deletes the previous avatar when existing imageUrl resolves to an avatars/ key', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      ...fakeUser,
      imageUrl: 'http://localhost:9000/app-uploads/avatars/old.jpg',
    });
    mockPrisma.user.update.mockResolvedValue(fakeUser);
    mockStorage.resolveKeyFromUrl.mockResolvedValue('avatars/old.jpg');
    await useCase.execute('u1', { image: jpeg(), contentType: 'image/jpeg' });
    expect(mockStorage.resolveKeyFromUrl).toHaveBeenCalledWith(
      'http://localhost:9000/app-uploads/avatars/old.jpg',
    );
    expect(mockStorage.delete).toHaveBeenCalledWith('avatars/old.jpg');
  });

  it('does not delete when the resolved key is outside avatars/', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      ...fakeUser,
      imageUrl: 'http://external/img.png',
    });
    mockPrisma.user.update.mockResolvedValue(fakeUser);
    mockStorage.resolveKeyFromUrl.mockResolvedValue(null);
    await useCase.execute('u1', { image: jpeg(), contentType: 'image/jpeg' });
    expect(mockStorage.delete).not.toHaveBeenCalled();
  });
});
