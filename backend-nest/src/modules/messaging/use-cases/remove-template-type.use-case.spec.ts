import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { RemoveTemplateTypeUseCase } from './remove-template-type.use-case';

describe('RemoveTemplateTypeUseCase', () => {
  const prisma = {
    messagingTemplateType: { findUnique: vi.fn(), delete: vi.fn() },
    messagingTemplate: { findMany: vi.fn() },
  };
  const useCase = new RemoveTemplateTypeUseCase(prisma as never);

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.messagingTemplateType.findUnique.mockResolvedValue({ id: 'type-1', key: 'ORDER' });
    prisma.messagingTemplate.findMany.mockResolvedValue([]);
  });

  it('tipo inexistente é 404', async () => {
    prisma.messagingTemplateType.findUnique.mockResolvedValue(null);
    await expect(useCase.execute('x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('tipo com isSystem=true não pode ser removido e lança BadRequestException', async () => {
    prisma.messagingTemplateType.findUnique.mockResolvedValue({
      id: 'type-sys',
      key: 'PASSWORD_CHANGED',
      isSystem: true,
    });
    await expect(useCase.execute('type-sys')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.messagingTemplateType.delete).not.toHaveBeenCalled();
  });

  it('tipo sem templates é removido', async () => {
    await expect(useCase.execute('type-1')).resolves.toMatchObject({ status: true });
    expect(prisma.messagingTemplateType.delete).toHaveBeenCalledWith({ where: { id: 'type-1' } });
  });

  it('tipo em uso é 409 com o motivo e os templates; nada é apagado', async () => {
    prisma.messagingTemplate.findMany.mockResolvedValue([
      { key: 'ORDER_NEW', language: 'pt-BR' },
      { key: 'ORDER_NEW', language: 'en' },
    ]);
    const error = await useCase.execute('type-1').catch((e) => e);

    expect(error).toBeInstanceOf(ConflictException);
    expect(error.message).toContain('"ORDER" está em uso por 2 template(s)');
    expect(error.message).toContain('ORDER_NEW (pt-BR), ORDER_NEW (en)');
    expect(prisma.messagingTemplateType.delete).not.toHaveBeenCalled();
  });

  it('lista só os primeiros e resume o resto', async () => {
    prisma.messagingTemplate.findMany.mockResolvedValue(
      Array.from({ length: 8 }, (_, i) => ({ key: `T${i}`, language: 'pt-BR' })),
    );
    const error = await useCase.execute('type-1').catch((e) => e);
    expect(error.message).toContain('e mais 3');
  });
});
