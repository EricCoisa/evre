import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UpdateTemplateUseCase } from './update-template.use-case';

describe('UpdateTemplateUseCase', () => {
  const prisma = {
    messagingTemplate: { findUnique: vi.fn(), update: vi.fn() },
    messagingTemplateSubmission: { updateMany: vi.fn() },
  };
  const useCase = new UpdateTemplateUseCase(prisma as never);

  const EXISTING = {
    id: 'tpl-1',
    body: 'corpo antigo {{ first_name }}',
    header: null,
    footer: null,
    buttons: null,
    type: {
      variables: [{ name: 'first_name' }, { name: 'full_name', reserved: true }],
    },
  };

  beforeEach(() => vi.clearAllMocks());

  it('id inexistente é 404', async () => {
    prisma.messagingTemplate.findUnique.mockResolvedValue(null);
    await expect(useCase.execute('nada', {} as never)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('body novo usando variável fora do tipo é 400, sem gravar', async () => {
    prisma.messagingTemplate.findUnique.mockResolvedValue(EXISTING);
    await expect(
      useCase.execute('tpl-1', { body: 'novo {{ last_name }}' } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.messagingTemplate.update).not.toHaveBeenCalled();
  });

  it('body novo usando variável reservada (full_name) é aceito mesmo fora do tipo', async () => {
    prisma.messagingTemplate.findUnique.mockResolvedValue(EXISTING);
    prisma.messagingTemplate.update.mockResolvedValue({ id: 'tpl-1' });

    await useCase.execute('tpl-1', { body: 'novo {{ full_name }}' } as never);

    expect(prisma.messagingTemplate.update).toHaveBeenCalled();
  });

  it('campo omitido mantém o valor existente na checagem e na gravação', async () => {
    prisma.messagingTemplate.findUnique.mockResolvedValue(EXISTING);
    prisma.messagingTemplate.update.mockResolvedValue({ id: 'tpl-1' });

    await useCase.execute('tpl-1', { footer: 'novo rodapé' } as never);

    expect(prisma.messagingTemplate.update).toHaveBeenCalledWith({
      where: { id: 'tpl-1' },
      data: {
        body: EXISTING.body,
        header: null,
        footer: 'novo rodapé',
        buttons: null,
      },
    });
  });

  // Editar não toca a Meta: o status segue o real, e só se marca que o texto local divergiu.
  it('editar conteúdo marca as submissões como fora de sincronia, sem mexer no status', async () => {
    prisma.messagingTemplate.findUnique.mockResolvedValue(EXISTING);
    prisma.messagingTemplate.update.mockResolvedValue({ id: 'tpl-1' });

    await useCase.execute('tpl-1', { footer: 'novo rodapé' } as never);

    expect(prisma.messagingTemplateSubmission.updateMany).toHaveBeenCalledWith({
      where: { templateId: 'tpl-1' },
      data: { outOfSync: true },
    });
  });

  it('dar ciente da categoria limpa o aviso e não desincroniza', async () => {
    prisma.messagingTemplate.findUnique.mockResolvedValue(EXISTING);
    prisma.messagingTemplate.update.mockResolvedValue({ id: 'tpl-1' });

    await useCase.execute('tpl-1', { acknowledgeCategoryChange: true } as never);

    expect(prisma.messagingTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ previousCategory: null, categoryChangedAt: null }),
      }),
    );
    expect(prisma.messagingTemplateSubmission.updateMany).not.toHaveBeenCalled();
  });

  it('só bypassOptOut (sem tocar conteúdo) não reabre submissões', async () => {
    prisma.messagingTemplate.findUnique.mockResolvedValue(EXISTING);
    prisma.messagingTemplate.update.mockResolvedValue({ id: 'tpl-1' });

    await useCase.execute('tpl-1', { bypassOptOut: true } as never);

    expect(prisma.messagingTemplateSubmission.updateMany).not.toHaveBeenCalled();
  });

  describe('template que requer ajuste (tipo mudou)', () => {
    const INVALID = {
      ...EXISTING,
      body: 'Pedido {{ order }}',
      invalidatedAt: new Date('2026-01-01'),
      invalidReason: 'x',
      type: { variables: [{ name: 'order', type: 'STRING', required: true }], buttons: [] },
    };

    it('salvar com conteúdo que cumpre o tipo limpa o aviso', async () => {
      prisma.messagingTemplate.findUnique.mockResolvedValue(INVALID);
      prisma.messagingTemplate.update.mockResolvedValue({ id: 'tpl-1' });

      await useCase.execute('tpl-1', { body: 'Pedido {{ order }} confirmado' } as never);

      expect(prisma.messagingTemplate.update).toHaveBeenCalledWith({
        where: { id: 'tpl-1' },
        data: expect.objectContaining({ invalidatedAt: null, invalidReason: null }),
      });
    });

    it('mesmo sem campos de conteúdo, o contrato é reavaliado: ainda inválido = 400 com o motivo', async () => {
      prisma.messagingTemplate.findUnique.mockResolvedValue({ ...INVALID, body: 'sem variável' });
      await expect(
        useCase.execute('tpl-1', { bypassOptOut: true } as never),
      ).rejects.toThrow(/obrigatórias.*order/);
      expect(prisma.messagingTemplate.update).not.toHaveBeenCalled();
    });
  });

  it('template antigo sem o botão que o tipo passou a exigir continua editável em campos sem relação', async () => {
    prisma.messagingTemplate.findUnique.mockResolvedValue({
      ...EXISTING,
      type: { ...EXISTING.type, buttons: [{ key: 'accept', kind: 'QUICK_REPLY' }] },
    });
    prisma.messagingTemplate.update.mockResolvedValue({ id: 'tpl-1' });

    await expect(useCase.execute('tpl-1', { bypassOptOut: true } as never)).resolves.toBeDefined();
  });

  it('variável obrigatória do tipo que o novo texto deixa de usar é 400', async () => {
    prisma.messagingTemplate.findUnique.mockResolvedValue({
      ...EXISTING,
      type: { variables: [{ name: 'order', type: 'STRING', required: true }] },
    });
    await expect(
      useCase.execute('tpl-1', { body: 'sem a variável' } as never),
    ).rejects.toThrow(/obrigatórias.*order/);
  });
});
