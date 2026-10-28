import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { CreateTemplateUseCase } from './create-template.use-case';

describe('CreateTemplateUseCase', () => {
  const prisma = {
    messagingTemplateType: { findUnique: vi.fn() },
    messagingTemplate: { findUnique: vi.fn(), create: vi.fn() },
  };
  const useCase = new CreateTemplateUseCase(prisma as never);

  const TYPE = {
    id: 'type-1',
    variables: [{ name: 'first_name' }, { name: 'full_name', reserved: true }],
  };
  const dto = (over: Record<string, unknown> = {}) => ({
    typeId: 'type-1',
    key: 'PASSWORD_CHANGED',
    language: 'pt-BR',
    category: 'UTILITY',
    body: 'Olá {{ first_name }}',
    ...over,
  });

  beforeEach(() => vi.clearAllMocks());

  it('typeId inexistente é 404, antes de checar duplicidade', async () => {
    prisma.messagingTemplateType.findUnique.mockResolvedValue(null);
    await expect(useCase.execute(dto() as never)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.messagingTemplate.findUnique).not.toHaveBeenCalled();
  });

  it('(key, language) já existente é 409', async () => {
    prisma.messagingTemplateType.findUnique.mockResolvedValue(TYPE);
    prisma.messagingTemplate.findUnique.mockResolvedValue({ id: 'existing' });

    await expect(useCase.execute(dto() as never)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.messagingTemplate.create).not.toHaveBeenCalled();
  });

  it('corpo usando variável fora do tipo é 400, antes de gravar', async () => {
    prisma.messagingTemplateType.findUnique.mockResolvedValue(TYPE);
    prisma.messagingTemplate.findUnique.mockResolvedValue(null);

    await expect(
      useCase.execute(dto({ body: 'Olá {{ last_name }}' }) as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.messagingTemplate.create).not.toHaveBeenCalled();
  });

  it('corpo usando variável reservada (full_name) é aceito mesmo fora das variables do tipo', async () => {
    prisma.messagingTemplateType.findUnique.mockResolvedValue(TYPE);
    prisma.messagingTemplate.findUnique.mockResolvedValue(null);
    prisma.messagingTemplate.create.mockResolvedValue({ id: 'tpl-1' });

    await useCase.execute(dto({ body: 'Olá {{ full_name }}' }) as never);

    expect(prisma.messagingTemplate.create).toHaveBeenCalled();
  });

  it('reservada não liberada pelo tipo é 400', async () => {
    prisma.messagingTemplateType.findUnique.mockResolvedValue({ ...TYPE, variables: [{ name: 'first_name' }] });
    prisma.messagingTemplate.findUnique.mockResolvedValue(null);

    await expect(
      useCase.execute(dto({ body: 'Olá {{ full_name }}' }) as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.messagingTemplate.create).not.toHaveBeenCalled();
  });

  it('cria quando tipo existe, chave livre e corpo bate com o tipo', async () => {
    prisma.messagingTemplateType.findUnique.mockResolvedValue(TYPE);
    prisma.messagingTemplate.findUnique.mockResolvedValue(null);
    prisma.messagingTemplate.create.mockResolvedValue({ id: 'tpl-1' });

    await useCase.execute(dto() as never);

    expect(prisma.messagingTemplate.create).toHaveBeenCalledWith({
      data: {
        typeId: 'type-1',
        key: 'PASSWORD_CHANGED',
        language: 'pt-BR',
        category: 'UTILITY',
        header: null,
        body: 'Olá {{ first_name }}',
        footer: null,
        buttons: null,
        bypassOptOut: false,
      },
    });
  });

  describe('botões tipados do tipo', () => {
    const TYPED = {
      ...TYPE,
      buttons: [
        { key: 'accept', kind: 'QUICK_REPLY' },
        { key: 'track', kind: 'URL', urlBase: 'https://app.test/o/' },
      ],
    };

    it('grava a URL do tipo (não a digitada) e aceita o placeholder do sufixo no corpo da URL', async () => {
      prisma.messagingTemplateType.findUnique.mockResolvedValue(TYPED);
      prisma.messagingTemplate.findUnique.mockResolvedValue(null);

      await useCase.execute(
        dto({
          buttons: [
            { kind: 'QUICK_REPLY', label: 'Aceitar', slot: 'accept', payload: 'forjado' },
            { kind: 'URL', label: 'Ver', url: 'https://evil.test', slot: 'track' },
          ],
        }) as never,
      );

      expect(prisma.messagingTemplate.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          buttons: [
            { kind: 'QUICK_REPLY', label: 'Aceitar', slot: 'accept' },
            { kind: 'URL', label: 'Ver', url: 'https://app.test/o/{{ track }}', slot: 'track' },
          ],
        }),
      });
    });

    it('espaço obrigatório ausente é 400, antes de gravar', async () => {
      prisma.messagingTemplateType.findUnique.mockResolvedValue(TYPED);
      prisma.messagingTemplate.findUnique.mockResolvedValue(null);

      await expect(useCase.execute(dto({ buttons: [] }) as never)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.messagingTemplate.create).not.toHaveBeenCalled();
    });

    it('AUTHENTICATION ignora os espaços do tipo: sem botões nossos, sem exigir os obrigatórios', async () => {
      prisma.messagingTemplateType.findUnique.mockResolvedValue(TYPED);
      prisma.messagingTemplate.findUnique.mockResolvedValue(null);

      await useCase.execute(dto({ category: 'AUTHENTICATION', buttons: [] }) as never);

      expect(prisma.messagingTemplate.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ buttons: null }),
      });
    });
  });
});
