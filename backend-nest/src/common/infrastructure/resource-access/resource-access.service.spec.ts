import { NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AuthenticatedUser } from '../../types/auth.types';
import { ResourceAccessService } from './resource-access.service';

describe('ResourceAccessService', () => {
  let service: ResourceAccessService;
  let prisma: {
    membership: {
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
  };
  let i18n: { t: ReturnType<typeof vi.fn> };

  const admin: AuthenticatedUser = {
    id: 'admin-1',
    email: 'admin@example.com',
    roleId: 'role-admin',
    roleName: 'ADMIN',
  };
  const user: AuthenticatedUser = {
    id: 'user-1',
    email: 'user@example.com',
    roleId: 'role-user',
    roleName: 'USER',
  };

  beforeEach(() => {
    prisma = {
      membership: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
      },
    };
    i18n = { t: vi.fn((key: string) => key) };

    service = new ResourceAccessService(
      prisma as unknown as PrismaService,
      i18n as unknown as I18nService,
    );
  });

  it('regra 1: ADMIN sempre libera, sem consultar Membership', async () => {
    await expect(
      service.assertCanRead(admin, { companyId: 'company-1' }),
    ).resolves.toBeUndefined();
    expect(prisma.membership.findFirst).not.toHaveBeenCalled();
  });

  it('regra 2: nega com NotFoundException (não Forbidden) quando não há Membership que alcance o escopo', async () => {
    prisma.membership.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.assertCanRead(user, { companyId: 'company-1' }),
    ).rejects.toThrow(NotFoundException);
    expect(i18n.t).toHaveBeenCalledWith('resource_access.not_found');
  });

  it('regra 3: escopo vazio nega para não-ADMIN, nunca "sem escopo = tudo"', async () => {
    await expect(service.assertCanRead(user, {})).rejects.toThrow(
      NotFoundException,
    );
    expect(i18n.t).toHaveBeenCalledWith('resource_access.no_scope');
    expect(prisma.membership.findFirst).not.toHaveBeenCalled();
  });

  it('regra 4: canSeeCommercials só é true com Membership que alcance o escopo e a flag ligada', async () => {
    prisma.membership.findFirst.mockResolvedValueOnce(null);

    const result = await service.canSeeCommercials(user, {
      companyId: 'company-1',
    });

    expect(result).toBe(false);
    expect(prisma.membership.findFirst).toHaveBeenCalledWith({
      where: {
        userId: user.id,
        canSeeCommercials: true,
        OR: [{ companyId: 'company-1' }],
      },
    });
  });

  it('regra 5: scopeFilter devolve undefined para ADMIN e um where restritivo (nunca {}) para os demais', async () => {
    prisma.membership.findMany.mockResolvedValueOnce([
      { companyId: 'company-1', projectId: null },
    ]);

    const adminFilter = await service.scopeFilter(admin);
    const userFilter = await service.scopeFilter(user);

    expect(adminFilter).toBeUndefined();
    expect(userFilter).toEqual({
      OR: [{ companyId: { in: ['company-1'] } }, { projectId: { in: [] } }],
    });
  });
});
