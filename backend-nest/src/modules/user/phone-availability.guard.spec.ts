import { ConflictException, type ExecutionContext } from '@nestjs/common';
import { PhoneAvailabilityGuard } from './phone-availability.guard';
import type { PrismaService } from '../../prisma/prisma.service';
import type { I18nService } from 'nestjs-i18n';

const mockI18n = { t: vi.fn((k: string) => k) } as unknown as I18nService;

function contextWith(body: Record<string, unknown>, userId = 'u1') {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ body, user: { id: userId } }),
    }),
  } as unknown as ExecutionContext;
}

describe('PhoneAvailabilityGuard', () => {
  it('phone ausente no body passa sem consultar', async () => {
    const findUnique = vi.fn();
    const guard = new PhoneAvailabilityGuard(
      { user: { findUnique } } as unknown as PrismaService,
      mockI18n,
    );

    await expect(
      guard.canActivate(contextWith({ name: 'Nova Pessoa' })),
    ).resolves.toBe(true);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('phone livre (nenhum dono) libera', async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const guard = new PhoneAvailabilityGuard(
      { user: { findUnique } } as unknown as PrismaService,
      mockI18n,
    );

    await expect(
      guard.canActivate(contextWith({ phone: '+5511999998888' })),
    ).resolves.toBe(true);
  });

  it('phone já usado pelo próprio usuário libera', async () => {
    const findUnique = vi
      .fn()
      .mockResolvedValue({ id: 'u1', phone: '+5511999998888' });
    const guard = new PhoneAvailabilityGuard(
      { user: { findUnique } } as unknown as PrismaService,
      mockI18n,
    );

    await expect(
      guard.canActivate(contextWith({ phone: '+5511999998888' }, 'u1')),
    ).resolves.toBe(true);
  });

  it('phone usado por outro usuário rejeita com ConflictException', async () => {
    const findUnique = vi
      .fn()
      .mockResolvedValue({ id: 'u2', phone: '+5511999998888' });
    const guard = new PhoneAvailabilityGuard(
      { user: { findUnique } } as unknown as PrismaService,
      mockI18n,
    );

    await expect(
      guard.canActivate(contextWith({ phone: '+5511999998888' }, 'u1')),
    ).rejects.toThrow(ConflictException);
  });
});
