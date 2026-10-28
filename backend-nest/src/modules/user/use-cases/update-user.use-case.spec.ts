import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { UpdateUserUseCase } from './update-user.use-case';
import { GetUserImageUseCase } from './get-user-image.use-case';
import { GetSystemRolesUseCase } from './get-system-roles.use-case';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { I18nService } from 'nestjs-i18n';
import type { PayloadUserRepository } from '../../auth/adapters/payload-user.repository';


const mockPrisma = {
  user: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  route: { findFirst: vi.fn() },
  userRouteAccess: { findFirst: vi.fn() },
  refreshToken: { deleteMany: vi.fn().mockResolvedValue({}) },
  role: { findMany: vi.fn() },
};
const mockPayloadRepo = {
  findByEmail: vi.fn(),
  delete: vi.fn().mockResolvedValue(undefined),
};

const prisma = mockPrisma as unknown as PrismaService;
const i18n = { t: vi.fn((k: string) => k) } as unknown as I18nService;
const payloadRepo = mockPayloadRepo as unknown as PayloadUserRepository;

const fakeUser = {
  id: 'u1',
  email: 'test@example.com',
  name: 'Test User',
  role: 'USER',
  status: 'ACTIVE',
  hash: 'hash',
  salt: 'salt',
  image: null,
  imageUrl: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const useCase = () => new UpdateUserUseCase(prisma, i18n, payloadRepo);

/** Estado inicial comum dos casos que reativam um usuário. */
function arrangeReactivation() {
  mockPrisma.user.findFirst.mockResolvedValueOnce({ ...fakeUser, status: 'INACTIVE' });
  mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'u1' });
  mockPrisma.user.update.mockResolvedValue({ ...fakeUser, status: 'ACTIVE' });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.user.findUnique.mockReset();
  mockPrisma.user.findFirst.mockReset();
});

describe('UpdateUserUseCase', () => {
  it('lança NotFoundException quando o usuário não existe', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    await expect(useCase().execute('missing', { role: 'ADMIN' } as never)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('update sem mudança de status não revoga sessões', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(fakeUser);
    mockPrisma.user.update.mockResolvedValue({ ...fakeUser, roleRecord: { name: 'ADMIN' } });
    await expect(useCase().execute('u1', { role: 'ADMIN' } as never)).resolves.toHaveProperty(
      'role',
      'ADMIN',
    );
    expect(mockPrisma.refreshToken.deleteMany).not.toHaveBeenCalled();
  });

  it('atualiza phone quando informado', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(fakeUser);
    mockPrisma.user.update.mockResolvedValue({ ...fakeUser, phone: '+5511999998888' });
    await useCase().execute('u1', { phone: '+5511999998888' } as never);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ phone: '+5511999998888' }) }),
    );
  });

  it.each(['INACTIVE', 'SUSPENDED'])('status %s revoga sessões', async (status) => {
    mockPrisma.user.findFirst.mockResolvedValue(fakeUser);
    mockPayloadRepo.findByEmail.mockResolvedValue({ id: 42, email: fakeUser.email });
    mockPrisma.user.update.mockResolvedValue({ ...fakeUser, status });
    await useCase().execute('u1', { status } as never);
    expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalled();
  });

  it('desativar apaga a conta do CMS', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(fakeUser);
    mockPayloadRepo.findByEmail.mockResolvedValue({ id: 42, email: fakeUser.email });
    mockPrisma.user.update.mockResolvedValue({ ...fakeUser, status: 'INACTIVE' });
    await useCase().execute('u1', { status: 'INACTIVE' } as never);
    expect(mockPayloadRepo.delete).toHaveBeenCalledWith(42);
  });

  it('desativar sem conta no CMS não tenta apagar', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(fakeUser);
    mockPayloadRepo.findByEmail.mockResolvedValue(null);
    mockPrisma.user.update.mockResolvedValue({ ...fakeUser, status: 'SUSPENDED' });
    await useCase().execute('u1', { status: 'SUSPENDED' } as never);
    expect(mockPayloadRepo.delete).not.toHaveBeenCalled();
  });

  // Reativar não mexe no Payload: o próximo acesso a /cms recria a conta,
  // pelo mesmo caminho do primeiro acesso de qualquer usuário.
  it('reativar não toca no Payload', async () => {
    arrangeReactivation();
    await useCase().execute('u1', { status: 'ACTIVE' } as never);
    expect(mockPayloadRepo.findByEmail).not.toHaveBeenCalled();
    expect(mockPayloadRepo.delete).not.toHaveBeenCalled();
  });

  // O CMS é secundário: se o Payload estiver fora do ar, mudar o status do usuário
  // no sistema principal ainda tem que funcionar.
  it('erro do Payload ao apagar não derruba o update', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(fakeUser);
    mockPayloadRepo.findByEmail.mockRejectedValue(new Error('db error'));
    mockPrisma.user.update.mockResolvedValue({ ...fakeUser, status: 'INACTIVE' });
    await expect(useCase().execute('u1', { status: 'INACTIVE' } as never)).resolves.toBeDefined();
  });
});

describe('GetUserImageUseCase', () => {
  const uc = () => new GetUserImageUseCase(prisma, i18n);

  it('lança NotFoundException quando o usuário não existe', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    await expect(uc().execute('missing')).rejects.toThrow(NotFoundException);
  });

  it('devolve null quando não há imagem', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ image: null });
    await expect(uc().execute('u1')).resolves.toBeNull();
  });

  it('converte Uint8Array em Buffer', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ image: new Uint8Array([1, 2, 3]) });
    const result = await uc().execute('u1');
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result).toEqual(Buffer.from([1, 2, 3]));
  });

  it('devolve o Buffer direto quando já é Buffer', async () => {
    const buf = Buffer.from([9, 9]);
    mockPrisma.user.findFirst.mockResolvedValue({ image: buf });
    await expect(uc().execute('u1')).resolves.toBe(buf);
  });
});

describe('GetSystemRolesUseCase', () => {
  it('devolve as roles como pares value/label', async () => {
    mockPrisma.role.findMany.mockResolvedValue([
      { id: 'r-admin', name: 'ADMIN' },
      { id: 'r-user', name: 'USER' },
    ]);
    const result = await new GetSystemRolesUseCase(prisma).execute();
    // value = id (é o que o form envia de volta), label = nome exibido
    expect(result).toEqual([
      { value: 'r-admin', label: 'ADMIN' },
      { value: 'r-user', label: 'USER' },
    ]);
  });
});
