import { ConflictException } from '@nestjs/common';
import { CreateTemplateTypeUseCase } from './create-template-type.use-case';

describe('CreateTemplateTypeUseCase', () => {
  const prisma = {
    messagingTemplateType: { findUnique: vi.fn(), create: vi.fn() },
  };
  const useCase = new CreateTemplateTypeUseCase(prisma as never);

  beforeEach(() => vi.clearAllMocks());

  it('cria quando a key não existe ainda', async () => {
    prisma.messagingTemplateType.findUnique.mockResolvedValue(null);
    prisma.messagingTemplateType.create.mockResolvedValue({ id: 't-1' });

    await useCase.execute({
      key: 'ORDER_UPDATE',
      name: 'Atualização de pedido',
      variables: [],
    } as never);

    expect(prisma.messagingTemplateType.create).toHaveBeenCalledWith({
      data: { key: 'ORDER_UPDATE', name: 'Atualização de pedido', variables: [] },
    });
  });

  it('key já existente é 409, sem tentar criar', async () => {
    prisma.messagingTemplateType.findUnique.mockResolvedValue({ id: 'existing' });

    await expect(
      useCase.execute({ key: 'ORDER_UPDATE', name: 'x', variables: [] } as never),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.messagingTemplateType.create).not.toHaveBeenCalled();
  });
});
