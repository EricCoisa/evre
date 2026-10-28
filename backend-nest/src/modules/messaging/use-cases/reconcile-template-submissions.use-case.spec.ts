import { ReconcileTemplateSubmissionsUseCase } from './reconcile-template-submissions.use-case';

describe('ReconcileTemplateSubmissionsUseCase', () => {
  const prisma = {
    messagingTemplateSubmission: { findMany: vi.fn(), update: vi.fn() },
    messagingTemplate: { update: vi.fn() },
  };
  const fetchTemplateStatuses = vi.fn();
  const connections = {
    getActive: vi.fn().mockResolvedValue({ id: 'conn-meta' }),
    use: vi.fn().mockReturnValue({ fetchTemplateStatuses }),
  };
  const events = { emit: vi.fn() };
  const notifications = { notify: vi.fn() };
  const useCase = new ReconcileTemplateSubmissionsUseCase(
    prisma as never,
    connections as never,
    events as never,
    notifications as never,
  );

  const sub = (over: Record<string, unknown> = {}) => ({
    id: 's-1',
    templateId: 't-1',
    providerTemplateId: 'wa-1',
    status: 'PENDING',
    reason: null,
    template: { key: 'TPL_X', category: 'UTILITY' },
    ...over,
  });
  const remote = (over: Record<string, unknown> = {}) => ({
    providerTemplateId: 'wa-1',
    name: 'x',
    language: 'pt-BR',
    status: 'APPROVED',
    ...over,
  });

  beforeEach(() => vi.clearAllMocks());

  it('conexão sem templates submetidos: não consulta a rede', async () => {
    prisma.messagingTemplateSubmission.findMany.mockResolvedValue([]);
    expect(await useCase.execute('conn-meta')).toEqual({ updated: 0 });
    expect(connections.getActive).not.toHaveBeenCalled();
  });

  it('conexão sem fetchTemplateStatuses (Evolution) não atualiza nada', async () => {
    prisma.messagingTemplateSubmission.findMany.mockResolvedValue([sub()]);
    connections.use.mockReturnValueOnce({});
    expect(await useCase.execute('conn-evo')).toEqual({ updated: 0 });
  });

  it('atualiza o que mudou na Meta e avisa as telas', async () => {
    prisma.messagingTemplateSubmission.findMany.mockResolvedValue([
      sub(),
      sub({ id: 's-2', providerTemplateId: 'wa-2' }),
    ]);
    fetchTemplateStatuses.mockResolvedValue([
      remote(),
      remote({ providerTemplateId: 'wa-2', status: 'REJECTED', reason: 'INVALID_FORMAT' }),
      remote({ providerTemplateId: 'wa-outro' }),
    ]);

    expect(await useCase.execute('conn-meta')).toEqual({ updated: 2 });
    expect(prisma.messagingTemplateSubmission.update).toHaveBeenCalledWith({
      where: { id: 's-2' },
      data: { status: 'REJECTED', reason: 'INVALID_FORMAT', reviewedAt: expect.any(Date) },
    });
    expect(events.emit).toHaveBeenCalledWith({ type: 'templates' });
    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({ recipients: { roleNames: ['ADMIN'] } }),
    );
  });

  it('nada mudou na Meta: não grava nem avisa as telas', async () => {
    prisma.messagingTemplateSubmission.findMany.mockResolvedValue([sub({ status: 'APPROVED' })]);
    fetchTemplateStatuses.mockResolvedValue([remote({ category: 'UTILITY' })]);

    expect(await useCase.execute('conn-meta')).toEqual({ updated: 0 });
    expect(prisma.messagingTemplateSubmission.update).not.toHaveBeenCalled();
    expect(events.emit).not.toHaveBeenCalled();
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('Meta reclassificou: categoria local acompanha e guarda a anterior para o aviso', async () => {
    prisma.messagingTemplateSubmission.findMany.mockResolvedValue([sub({ status: 'APPROVED' })]);
    fetchTemplateStatuses.mockResolvedValue([remote({ category: 'MARKETING' })]);

    expect(await useCase.execute('conn-meta')).toEqual({ updated: 1 });
    expect(prisma.messagingTemplate.update).toHaveBeenCalledWith({
      where: { id: 't-1' },
      data: {
        category: 'MARKETING',
        previousCategory: 'UTILITY',
        categoryChangedAt: expect.any(Date),
      },
    });
    expect(events.emit).toHaveBeenCalledWith({ type: 'templates' });
  });
});
