import { IsVerifiedUseCase } from './is-verified.use-case';
import { VerificationMethod } from '../verification-method.enum';
import type { PrismaService } from '../../../prisma/prisma.service';

describe('IsVerifiedUseCase', () => {
  const findFirst = vi.fn();
  const update = vi.fn();
  const prisma = {
    verificationCode: { findFirst, update },
  } as unknown as PrismaService;
  const useCase = new IsVerifiedUseCase(prisma);

  beforeEach(() => vi.clearAllMocks());

  it('true quando existe um VerificationCode confirmado para (userId, purpose, target)', async () => {
    findFirst.mockResolvedValue({ id: 'vc1' });

    const result = await useCase.execute({
      userId: 'u1',
      purpose: 'USER_PHONE_CONFIRMATION',
      target: '+5511999998888',
    });

    expect(result).toBe(true);
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'u1',
        purpose: 'USER_PHONE_CONFIRMATION',
        target: '+5511999998888',
        consumedAt: { not: null },
      },
      orderBy: { consumedAt: 'desc' },
    });
  });

  it('false quando não existe nenhuma linha confirmada', async () => {
    findFirst.mockResolvedValue(null);

    const result = await useCase.execute({
      userId: 'u1',
      purpose: 'USER_PHONE_CONFIRMATION',
      target: '+5511999998888',
    });

    expect(result).toBe(false);
  });

  it('method ONCE: filtra usedAt null e consome (marca usedAt) ao liberar', async () => {
    findFirst.mockResolvedValue({ id: 'vc1' });

    const result = await useCase.execute({
      userId: 'u1',
      purpose: 'SENSITIVE_ACTION',
      target: '+5511999998888',
      method: VerificationMethod.ONCE,
    });

    expect(result).toBe(true);
    expect(findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({ usedAt: null }),
      orderBy: { consumedAt: 'desc' },
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'vc1' },
      data: { usedAt: expect.any(Date) },
    });
  });

  it('method ONCE: já consumido (usedAt preenchido) não aparece de novo — false, sem update', async () => {
    findFirst.mockResolvedValue(null);

    const result = await useCase.execute({
      userId: 'u1',
      purpose: 'SENSITIVE_ACTION',
      target: '+5511999998888',
      method: VerificationMethod.ONCE,
    });

    expect(result).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it('method TTL: filtra consumedAt dentro da janela de ttlSeconds', async () => {
    findFirst.mockResolvedValue({ id: 'vc1' });

    const result = await useCase.execute({
      userId: 'u1',
      purpose: 'SUDO_ACTION',
      target: '+5511999998888',
      method: VerificationMethod.TTL,
      ttlSeconds: 300,
    });

    expect(result).toBe(true);
    expect(findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        consumedAt: { gte: expect.any(Date) },
      }),
      orderBy: { consumedAt: 'desc' },
    });
    expect(update).not.toHaveBeenCalled();
  });
});
