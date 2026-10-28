import { ListTemplatesUseCase } from './list-templates.use-case';

describe('ListTemplatesUseCase', () => {
  const prisma = {
    messagingTemplate: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn() },
  };
  const useCase = new ListTemplatesUseCase(prisma as never);

  beforeEach(() => vi.clearAllMocks());

  it('sem connectionId devolve todas as submissões (status + motivo) e nenhum approvalStatus', async () => {
    const reviewedAt = new Date();
    prisma.messagingTemplate.findMany.mockResolvedValue([
      {
        id: 't-1',
        key: 'X',
        submissions: [
          { connectionId: 'c-1', status: 'REJECTED', reason: 'INVALID_FORMAT', reviewedAt, submittedAt: reviewedAt },
        ],
      },
    ]);
    const res = (await useCase.execute({ pagination: false } as never)) as Array<{
      approvalStatus?: string | null;
      submissions: unknown[];
    }>;

    expect(prisma.messagingTemplate.findMany.mock.calls[0][0]).toMatchObject({
      include: { submissions: true },
    });
    expect(res[0].approvalStatus).toBeUndefined();
    expect(res[0].submissions).toEqual([
      { connectionId: 'c-1', status: 'REJECTED', reason: 'INVALID_FORMAT', reviewedAt, submittedAt: reviewedAt },
    ]);
  });

  it('com connectionId, calcula approvalStatus a partir da submissão daquela conexão', async () => {
    prisma.messagingTemplate.findMany.mockResolvedValue([
      { id: 't-1', key: 'X', submissions: [{ status: 'APPROVED' }] },
      { id: 't-2', key: 'Y', submissions: [] },
    ]);

    const res = (await useCase.execute({
      pagination: false,
      connectionId: 'conn-meta',
    } as never)) as Array<{ id: string; approvalStatus?: string | null }>;

    expect(prisma.messagingTemplate.findMany.mock.calls[0][0]).toMatchObject({
      include: { submissions: { where: { connectionId: 'conn-meta' } } },
    });
    expect(res).toEqual([
      expect.objectContaining({ id: 't-1', approvalStatus: 'APPROVED' }),
      expect.objectContaining({ id: 't-2', approvalStatus: null }),
    ]);
  });
});
