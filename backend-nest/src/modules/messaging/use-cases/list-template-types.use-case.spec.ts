import { ListTemplateTypesUseCase } from './list-template-types.use-case';

describe('ListTemplateTypesUseCase', () => {
  it('cada tipo sai com templatesCount (a tela bloqueia excluir tipo em uso)', async () => {
    const prisma = {
      messagingTemplateType: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'a', key: 'A', _count: { templates: 2 } },
          { id: 'b', key: 'B', _count: { templates: 0 } },
        ]),
        count: vi.fn(),
      },
    };
    const res = (await new ListTemplateTypesUseCase(prisma as never).execute({
      pagination: false,
    } as never)) as unknown as Array<Record<string, unknown>>;

    expect(res).toEqual([
      { id: 'a', key: 'A', templatesCount: 2 },
      { id: 'b', key: 'B', templatesCount: 0 },
    ]);
    expect(res[0]).not.toHaveProperty('_count');
  });
});
