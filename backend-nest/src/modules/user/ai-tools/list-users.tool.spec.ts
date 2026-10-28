import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListUsersTool } from './list-users.tool';
import type { FindAllUsersUseCase } from '../use-cases/find-all-users.use-case';
import type { AiToolContext } from 'src/domain/ai/ai-tool.types';
import { PaginationQuerySchema } from 'src/common/schemas/pagination.schema';

const mockUseCase = { execute: vi.fn() } as unknown as FindAllUsersUseCase;
const ctx = { userId: 'u1', roleName: 'ADMIN', approvedScopes: [] } satisfies AiToolContext;

describe('ListUsersTool', () => {
  let tool: ListUsersTool;

  beforeEach(() => {
    vi.clearAllMocks();
    tool = new ListUsersTool(mockUseCase);
  });

  it('definition is well-formed', () => {
    expect(tool.definition.name).toBe('list_users');
    expect(tool.definition.roles).toContain('ADMIN');
    expect(tool.definition.inputSchema).toBeDefined();
  });

  it('execute delegates to use-case with correct args', async () => {
    mockUseCase.execute = vi.fn().mockResolvedValue({ data: [], meta: {} });
    // schema.safeParse() roda no ToolRegistry.dispatch() antes de execute() em produção
    const parsedInput = PaginationQuerySchema.parse({ page: '2', limit: '5', search: 'foo' });
    await tool.execute(parsedInput, ctx);
    expect(mockUseCase.execute).toHaveBeenCalledWith({
      page: 2, limit: 5, search: 'foo', pagination: true, filter: undefined,
    });
  });
});
