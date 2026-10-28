import {
  BadGatewayException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ProviderRequestError } from '../providers/provider-http.util';
import { SubmitTemplateUseCase } from './submit-template.use-case';

describe('SubmitTemplateUseCase', () => {
  const prisma = {
    messagingTemplate: { findUnique: vi.fn() },
    messagingTemplateSubmission: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() },
  };
  const submitTemplate = vi.fn();
  const fetchTemplateStatuses = vi.fn();
  const connections = {
    getActive: vi.fn().mockResolvedValue({ id: 'conn-meta' }),
    use: vi.fn().mockReturnValue({ submitTemplate, fetchTemplateStatuses }),
  };
  const notifications = { notify: vi.fn() };
  const useCase = new SubmitTemplateUseCase(
    prisma as never,
    connections as never,
    notifications as never,
  );

  // `order_id` (não reservada) prova a variável do tipo; first_name vem só da reservada,
  // com o example tirado da declaração (ver RESERVED_VARIABLES).
  const TEMPLATE = {
    key: 'PASSWORD_CHANGED',
    language: 'pt-BR',
    category: 'UTILITY',
    header: null,
    body: 'Olá {{ first_name }}, seu pedido {{ order_id }} saiu hoje.',
    footer: null,
    buttons: null,
    type: {
      variables: [
        { name: 'order_id', type: 'STRING', required: true },
        { name: 'first_name', reserved: true },
        { name: 'full_name', reserved: true },
      ],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    fetchTemplateStatuses.mockResolvedValue([]);
  });

  it('templateId inexistente é 404', async () => {
    prisma.messagingTemplate.findUnique.mockResolvedValue(null);
    await expect(
      useCase.execute('t-1', { connectionId: 'conn-meta', examples: {} } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('conexão sem submitTemplate (Evolution) é 400', async () => {
    prisma.messagingTemplate.findUnique.mockResolvedValue(TEMPLATE);
    connections.use.mockReturnValueOnce({});
    await expect(
      useCase.execute('t-1', { connectionId: 'conn-evo', examples: {} } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('example obrigatório ausente é 400, antes de chamar o provider', async () => {
    prisma.messagingTemplate.findUnique.mockResolvedValue(TEMPLATE);
    await expect(
      useCase.execute('t-1', { connectionId: 'conn-meta', examples: {} } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(submitTemplate).not.toHaveBeenCalled();
  });

  it('variável do tipo que o texto não usa não exige exemplo', async () => {
    prisma.messagingTemplate.findUnique.mockResolvedValue({
      ...TEMPLATE,
      body: 'Olá {{ first_name }}, seu pedido saiu hoje.',
    });
    prisma.messagingTemplateSubmission.findUnique.mockResolvedValue(null);
    submitTemplate.mockResolvedValue({ providerTemplateId: 'wa-1' });

    await useCase.execute('t-1', { connectionId: 'conn-meta', examples: {} } as never);

    expect(submitTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ examples: { first_name: 'Ana' } }),
      undefined,
    );
  });

  it('cria submissão PENDING quando não existe nenhuma (name/key imutáveis — nunca tocados)', async () => {
    prisma.messagingTemplate.findUnique.mockResolvedValue(TEMPLATE);
    prisma.messagingTemplateSubmission.findUnique.mockResolvedValue(null);
    submitTemplate.mockResolvedValue({ providerTemplateId: 'wa-1' });

    await useCase.execute('t-1', {
      connectionId: 'conn-meta',
      examples: { order_id: '12345' },
    } as never);

    expect(submitTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'password_changed', language: 'pt-BR' }),
      undefined,
    );
    expect(prisma.messagingTemplateSubmission.upsert).toHaveBeenCalledWith({
      where: { templateId_connectionId: { templateId: 't-1', connectionId: 'conn-meta' } },
      create: { templateId: 't-1', connectionId: 'conn-meta', providerTemplateId: 'wa-1', status: 'PENDING' },
      update: {
        providerTemplateId: 'wa-1',
        status: 'PENDING',
        reason: null,
        reviewedAt: null,
        outOfSync: false,
        submittedAt: expect.any(Date),
      },
    });
  });

  it('exemplo de variável reservada sai da declaração — o operador não precisa digitar o de first_name', async () => {
    prisma.messagingTemplate.findUnique.mockResolvedValue(TEMPLATE);
    prisma.messagingTemplateSubmission.findUnique.mockResolvedValue(null);
    submitTemplate.mockResolvedValue({ providerTemplateId: 'wa-1' });

    await useCase.execute('t-1', {
      connectionId: 'conn-meta',
      examples: { order_id: '12345' },
    } as never);

    expect(submitTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        examples: { order_id: '12345', first_name: 'Ana' },
      }),
      undefined,
    );
  });

  it('submissão existente edita (passa o providerTemplateId para o provider)', async () => {
    prisma.messagingTemplate.findUnique.mockResolvedValue(TEMPLATE);
    prisma.messagingTemplateSubmission.findUnique.mockResolvedValue({
      providerTemplateId: 'wa-old',
    });
    submitTemplate.mockResolvedValue({ providerTemplateId: 'wa-old' });

    await useCase.execute('t-1', {
      connectionId: 'conn-meta',
      examples: { order_id: '12345' },
    } as never);

    expect(submitTemplate).toHaveBeenCalledWith(expect.anything(), 'wa-old');
  });

  describe('erros do provider chegam ao operador', () => {
    beforeEach(() => {
      prisma.messagingTemplate.findUnique.mockResolvedValue(TEMPLATE);
      prisma.messagingTemplateSubmission.findUnique.mockResolvedValue(null);
    });
    const run = () =>
      useCase.execute('t-1', {
        connectionId: 'conn-meta',
        examples: { order_id: '1' },
      } as never);

    it('4xx da Meta vira 400 com o motivo', async () => {
      submitTemplate.mockRejectedValue(
        new ProviderRequestError('Meta 400: x', 400, 'Invalid parameter (code 100/2388043): Texto inválido'),
      );
      const error = await run().catch((e) => e);
      expect(error).toBeInstanceOf(BadRequestException);
      expect(error.message).toContain('Texto inválido');
    });

    it('5xx e falha de rede viram 502', async () => {
      submitTemplate.mockRejectedValueOnce(new ProviderRequestError('Meta 503', 503, 'down'));
      await expect(run()).rejects.toBeInstanceOf(BadGatewayException);
      submitTemplate.mockRejectedValueOnce(new Error('fetch failed'));
      await expect(run()).rejects.toBeInstanceOf(BadGatewayException);
    });
  });

  it('decisão já tomada na Meta logo após submeter é gravada (webhook chegou antes da submissão)', async () => {
    prisma.messagingTemplate.findUnique.mockResolvedValue(TEMPLATE);
    prisma.messagingTemplateSubmission.findUnique.mockResolvedValue(null);
    submitTemplate.mockResolvedValue({ providerTemplateId: 'wa-1' });
    prisma.messagingTemplateSubmission.upsert.mockResolvedValue({ id: 's-1', providerTemplateId: 'wa-1', status: 'PENDING' });
    fetchTemplateStatuses.mockResolvedValue([
      { providerTemplateId: 'wa-1', name: 'x', language: 'pt-BR', status: 'REJECTED', reason: 'INVALID_FORMAT' },
    ]);

    await useCase.execute('t-1', { connectionId: 'conn-meta', examples: { order_id: '1' } } as never);

    expect(prisma.messagingTemplateSubmission.update).toHaveBeenCalledWith({
      where: { id: 's-1' },
      data: expect.objectContaining({ status: 'REJECTED', reason: 'INVALID_FORMAT' }),
    });
    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({ recipients: { roleNames: ['ADMIN'] } }),
    );
  });

  it('link do sistema recebe sufixo de exemplo automático: o operador não digita token', async () => {
    prisma.messagingTemplate.findUnique.mockResolvedValue({
      ...TEMPLATE,
      body: 'Pedido confirmado',
      buttons: [{ kind: 'URL', label: 'Ver', url: 'https://app.test/o/{{ track }}', slot: 'track' }],
      type: {
        variables: [],
        buttons: [{ key: 'track', kind: 'URL', urlBase: 'https://app.test/o/' }],
      },
    });
    prisma.messagingTemplateSubmission.findUnique.mockResolvedValue(null);
    submitTemplate.mockResolvedValue({ providerTemplateId: 'wa-1' });

    await useCase.execute('t-1', { connectionId: 'conn-meta', examples: {} } as never);

    expect(submitTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        examples: { track: 'abc123' },
      }),
      undefined,
    );
  });

  it('template que requer ajuste não é submetido à Meta', async () => {
    prisma.messagingTemplate.findUnique.mockResolvedValue({
      ...TEMPLATE,
      invalidatedAt: new Date(),
      invalidReason: 'tipo mudou',
    });
    await expect(
      useCase.execute('t-1', { connectionId: 'conn-meta', examples: { order_id: '1' } } as never),
    ).rejects.toThrow(/requer ajuste.*tipo mudou/);
    expect(submitTemplate).not.toHaveBeenCalled();
  });

  describe('regras da Meta na submissão', () => {
    const run = () =>
      useCase.execute('t-1', { connectionId: 'conn-meta', examples: { order_id: '1' } } as never);

    it('variável no fim do corpo barra a submissão, com o motivo, sem chamar a Meta', async () => {
      prisma.messagingTemplate.findUnique.mockResolvedValue({
        ...TEMPLATE,
        body: 'Seu pedido é o {{ order_id }}',
      });
      const error = await run().catch((e) => e);

      expect(error).toBeInstanceOf(BadRequestException);
      expect(error.message).toContain('regras da Meta');
      expect(error.message).toContain('terminar com uma variável');
      expect(submitTemplate).not.toHaveBeenCalled();
    });

    it('lista todos os erros de uma vez (início, fim e rodapé)', async () => {
      prisma.messagingTemplate.findUnique.mockResolvedValue({
        ...TEMPLATE,
        body: '{{ order_id }} chegou {{ order_id }}',
        footer: 'Pedido {{ order_id }}',
      });
      const error = await run().catch((e) => e);
      expect(error.message).toContain('começar com uma variável');
      expect(error.message).toContain('terminar com uma variável');
      expect(error.message).toContain('rodapé');
    });

    it('aviso (ex.: Utilidade sem variável) não barra', async () => {
      prisma.messagingTemplate.findUnique.mockResolvedValue({
        ...TEMPLATE,
        body: 'Sua compra foi confirmada com sucesso, obrigado.',
        type: { variables: [], buttons: [] },
      });
      prisma.messagingTemplateSubmission.findUnique.mockResolvedValue(null);
      submitTemplate.mockResolvedValue({ providerTemplateId: 'wa-1' });
      prisma.messagingTemplateSubmission.upsert.mockResolvedValue({ id: 's-1', providerTemplateId: 'wa-1' });

      await run();
      expect(submitTemplate).toHaveBeenCalled();
    });

    it('autenticação é isenta: o corpo é o fixo da Meta', async () => {
      prisma.messagingTemplate.findUnique.mockResolvedValue({
        ...TEMPLATE,
        category: 'AUTHENTICATION',
        body: '{{ code }}',
        type: { variables: [{ name: 'code', type: 'STRING', required: true }], buttons: [] },
      });
      prisma.messagingTemplateSubmission.findUnique.mockResolvedValue(null);
      submitTemplate.mockResolvedValue({ providerTemplateId: 'wa-1' });
      prisma.messagingTemplateSubmission.upsert.mockResolvedValue({ id: 's-1', providerTemplateId: 'wa-1' });

      await run();
      expect(submitTemplate).toHaveBeenCalled();
    });
  });
});
