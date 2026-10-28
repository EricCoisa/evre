import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UpdateTemplateTypeUseCase } from './update-template-type.use-case';

describe('UpdateTemplateTypeUseCase', () => {
  const prisma = {
    messagingTemplateType: { findUnique: vi.fn(), update: vi.fn() },
    messagingTemplate: { findMany: vi.fn(), update: vi.fn() },
    messagingTemplateSubmission: { updateMany: vi.fn() },
  };
  const useCase = new UpdateTemplateTypeUseCase(prisma as never);

  const TYPE = {
    id: 'type-1',
    variables: [{ name: 'order', type: 'STRING', required: true }],
    buttons: [
      { key: 'accept', kind: 'QUICK_REPLY' },
      { key: 'track', kind: 'URL', urlBase: 'https://app.test/o/' },
    ],
  };
  const slotButtons = [
    { kind: 'QUICK_REPLY', label: 'Aceitar', slot: 'accept' },
    { kind: 'URL', label: 'Ver', url: 'https://app.test/o/{{ track }}', slot: 'track' },
  ];
  const template = (over: Record<string, unknown> = {}) => ({
    id: 't-1',
    category: 'UTILITY',
    body: 'Pedido {{ order }}',
    header: null,
    footer: null,
    buttons: slotButtons,
    invalidatedAt: null,
    ...over,
  });

  const lastTemplateUpdate = () => prisma.messagingTemplate.update.mock.calls.at(-1)?.[0];

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.messagingTemplateType.findUnique.mockResolvedValue(TYPE);
    prisma.messagingTemplateType.update.mockResolvedValue({ id: 'type-1' });
    prisma.messagingTemplate.findMany.mockResolvedValue([]);
  });

  it('tipo inexistente é 404', async () => {
    prisma.messagingTemplateType.findUnique.mockResolvedValue(null);
    await expect(useCase.execute('x', {} as never)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('só renomear o tipo não reavalia nenhum template', async () => {
    await useCase.execute('type-1', { name: 'Novo' } as never);
    expect(prisma.messagingTemplate.findMany).not.toHaveBeenCalled();
  });

  it('remover um espaço em uso INVALIDA o template (com o motivo) em vez de bloquear', async () => {
    prisma.messagingTemplate.findMany.mockResolvedValue([template()]);

    await useCase.execute('type-1', {
      buttons: [{ key: 'accept', kind: 'QUICK_REPLY', required: true }],
    } as never);

    expect(prisma.messagingTemplateType.update).toHaveBeenCalled();
    expect(lastTemplateUpdate()).toEqual({
      where: { id: 't-1' },
      data: {
        invalidatedAt: expect.any(Date),
        invalidReason: expect.stringContaining('track'),
      },
    });
  });

  it('remover uma variável usada no texto invalida; variável nova obrigatória e não usada também', async () => {
    prisma.messagingTemplate.findMany.mockResolvedValue([template()]);

    await useCase.execute('type-1', { variables: [] } as never);
    expect(lastTemplateUpdate().data.invalidReason).toContain('order');

    prisma.messagingTemplate.update.mockClear();
    await useCase.execute('type-1', {
      variables: [
        { name: 'order', type: 'STRING', required: true },
        { name: 'extra', type: 'STRING', required: true },
      ],
    } as never);
    expect(lastTemplateUpdate().data.invalidReason).toContain('extra');
  });

  it('template que continua cumprindo o tipo não é tocado (ex.: variável nova opcional)', async () => {
    prisma.messagingTemplate.findMany.mockResolvedValue([template()]);
    await useCase.execute('type-1', {
      variables: [
        { name: 'order', type: 'STRING', required: true },
        { name: 'extra', type: 'STRING', required: false, default: 'x' },
      ],
    } as never);
    expect(prisma.messagingTemplate.update).not.toHaveBeenCalled();
  });

  it('template já invalidado que passa a cumprir o contrato novo é liberado', async () => {
    prisma.messagingTemplate.findMany.mockResolvedValue([
      template({ invalidatedAt: new Date('2026-01-01') }),
    ]);
    await useCase.execute('type-1', { variables: TYPE.variables } as never);
    expect(lastTemplateUpdate().data).toEqual({ invalidatedAt: null, invalidReason: null });
  });

  it('já invalidado e ainda inválido: mantém a data da primeira invalidação e atualiza o motivo', async () => {
    const first = new Date('2026-01-01');
    prisma.messagingTemplate.findMany.mockResolvedValue([template({ invalidatedAt: first })]);
    await useCase.execute('type-1', { variables: [] } as never);
    expect(lastTemplateUpdate().data.invalidatedAt).toBe(first);
  });

  it('mudar a base do link reescreve a URL e marca a submissão como fora de sincronia', async () => {
    prisma.messagingTemplate.findMany.mockResolvedValue([template()]);
    await useCase.execute('type-1', {
      buttons: [
        { key: 'accept', kind: 'QUICK_REPLY', required: true },
        { key: 'track', kind: 'URL', urlBase: 'https://novo.test/p/', required: true },
      ],
    } as never);

    expect(lastTemplateUpdate().data.buttons).toEqual([
      slotButtons[0],
      { kind: 'URL', label: 'Ver', url: 'https://novo.test/p/{{ track }}', slot: 'track' },
    ]);
    expect(prisma.messagingTemplateSubmission.updateMany).toHaveBeenCalledWith({
      where: { templateId: 't-1' },
      data: { outOfSync: true },
    });
  });

  it('espaço novo obrigatório que o template não tem o invalida; chave colidindo com variável é 400', async () => {
    prisma.messagingTemplate.findMany.mockResolvedValue([template()]);
    await useCase.execute('type-1', {
      buttons: [...TYPE.buttons, { key: 'later', kind: 'QUICK_REPLY', required: true }],
    } as never);
    expect(lastTemplateUpdate().data.invalidReason).toContain('later');

    await expect(
      useCase.execute('type-1', {
        buttons: [{ key: 'order', kind: 'URL', urlBase: 'https://a.b/', required: true }],
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
