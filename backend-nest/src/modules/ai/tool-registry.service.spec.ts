import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ToolRegistry } from './tool-registry.service';
import type { IAiTool, AiToolContext } from 'src/domain/ai/ai-tool.types';

const mockZodToJsonSchema = vi.hoisted(() => vi.fn());
vi.mock('zod-to-json-schema', async (importOriginal) => {
  const real = await importOriginal<typeof import('zod-to-json-schema')>();
  mockZodToJsonSchema.mockImplementation(real.zodToJsonSchema);
  return { ...real, zodToJsonSchema: mockZodToJsonSchema };
});

const createFakeTool = (
  overrides: Partial<IAiTool['definition']> & { name: string; inputSchema: z.ZodType },
): IAiTool => ({
  definition: {
    name: overrides.name,
    description: overrides.description ?? 'Fake tool',
    inputSchema: overrides.inputSchema,
    roles: overrides.roles,
    invalidates: overrides.invalidates,
    approvalScope: overrides.approvalScope,
    descriptionKey: overrides.descriptionKey,
  },
  execute: vi.fn().mockResolvedValue({ ok: true }),
});

const makeDiscoveryMock = (
  tools: IAiTool[],
  hostNames: Record<string, string> = {},
) => {
  // Simula o que o DiscoveryService + Reflector entregariam
  return {
    getProviders: () =>
      tools.map((tool) => ({
        instance: tool,
        metatype: class Fake {
          static name = `Fake${tool.definition.name}`;
        },
        host: hostNames[tool.definition.name]
          ? { name: hostNames[tool.definition.name] }
          : undefined,
      })),
  };
};

const mockReflector = (expectedKey: string) => ({
  get: vi.fn((key: string) => key === expectedKey),
});

const mockLogging = {
  create: vi.fn().mockResolvedValue(undefined),
};

const makePrismaMock = (disabled: Array<{ userId: string; toolName: string }> = []) => ({
  userToolAccess: {
    findMany: vi.fn(({ where }: { where: { userId: string } }) =>
      Promise.resolve(
        disabled
          .filter((d) => d.userId === where.userId)
          .map((d) => ({ toolName: d.toolName })),
      ),
    ),
    findUnique: vi.fn(({ where }: { where: { userId_toolName: { userId: string; toolName: string } } }) =>
      Promise.resolve(
        disabled.find(
          (d) =>
            d.userId === where.userId_toolName.userId &&
            d.toolName === where.userId_toolName.toolName,
        ) ?? null,
      ),
    ),
  },
});

describe('ToolRegistry', () => {
  const adminCtx: AiToolContext = { userId: 'u1', roleName: 'admin', approvedScopes: [] };
  const userCtx: AiToolContext = { userId: 'u2', roleName: 'user', approvedScopes: [] };
  const approvedCtx: AiToolContext = { userId: 'u3', roleName: 'admin', approvedScopes: ['users:write'] };

  describe('onModuleInit — discovery', () => {
    it('registers tools found by DiscoveryService', async () => {
      const tool1 = createFakeTool({ name: 'tool_one', inputSchema: z.object({}) });
      const registry = new ToolRegistry(
        makeDiscoveryMock([tool1]) as any,
        mockReflector('AI_TOOL') as any,
        mockLogging as any,
        makePrismaMock() as any,
      );
      registry.onModuleInit();

      const defs = await registry.getToolDefinitions({ roleName: 'admin' });
      expect(defs).toHaveLength(1);
      expect(defs[0].name).toBe('tool_one');
    });

    it('throws on tool without name', () => {
      const badTool = createFakeTool({ name: '', inputSchema: z.object({}) });
      const registry = new ToolRegistry(
        makeDiscoveryMock([badTool]) as any,
        mockReflector('AI_TOOL') as any,
        mockLogging as any,
        makePrismaMock() as any,
      );
      expect(() => registry.onModuleInit()).toThrow('sem definition completa');
    });

    it('throws on duplicate tool name', () => {
      const tool1 = createFakeTool({ name: 'dup', inputSchema: z.object({}) });
      const tool2 = createFakeTool({ name: 'dup', inputSchema: z.object({}) });
      const registry = new ToolRegistry(
        makeDiscoveryMock([tool1, tool2]) as any,
        mockReflector('AI_TOOL') as any,
        mockLogging as any,
        makePrismaMock() as any,
      );
      expect(() => registry.onModuleInit()).toThrow('AiTool duplicada');
    });
  });

  describe('getToolDefinitions — role filtering', () => {
    it('returns only tools the role can use', async () => {
      const tool1 = createFakeTool({
        name: 'admin_only',
        inputSchema: z.object({}),
        roles: ['admin'],
      });
      const tool2 = createFakeTool({
        name: 'everyone',
        inputSchema: z.object({}),
      });
      const registry = new ToolRegistry(
        makeDiscoveryMock([tool1, tool2]) as any,
        mockReflector('AI_TOOL') as any,
        mockLogging as any,
        makePrismaMock() as any,
      );
      registry.onModuleInit();

      const adminDefs = await registry.getToolDefinitions({ roleName: 'admin' });
      expect(adminDefs).toHaveLength(2);

      const userDefs = await registry.getToolDefinitions({ roleName: 'user' });
      expect(userDefs).toHaveLength(1);
      expect(userDefs[0].name).toBe('everyone');
    });

    it('returns tools with no roles for any authenticated user', async () => {
      const tool = createFakeTool({
        name: 'open_tool',
        inputSchema: z.object({}),
      });
      const registry = new ToolRegistry(
        makeDiscoveryMock([tool]) as any,
        mockReflector('AI_TOOL') as any,
        mockLogging as any,
        makePrismaMock() as any,
      );
      registry.onModuleInit();

      const defs = await registry.getToolDefinitions({ roleName: 'guest' });
      expect(defs).toHaveLength(1);
    });

    it('converts inputSchema to JSON Schema', async () => {
      const tool = createFakeTool({
        name: 'with_schema',
        inputSchema: z.object({ name: z.string() }),
      });
      const registry = new ToolRegistry(
        makeDiscoveryMock([tool]) as any,
        mockReflector('AI_TOOL') as any,
        mockLogging as any,
        makePrismaMock() as any,
      );
      registry.onModuleInit();

      const defs = await registry.getToolDefinitions({ roleName: 'admin' });
      expect(defs[0].inputSchema).toBeTypeOf('object');
      expect(defs[0].inputSchema).not.toHaveProperty('$schema');
    });

    it('hasTool reports whether a tool was registered', async () => {
      const tool = createFakeTool({ name: 'known_tool', inputSchema: z.object({}) });
      const registry = new ToolRegistry(
        makeDiscoveryMock([tool]) as any,
        mockReflector('AI_TOOL') as any,
        mockLogging as any,
        makePrismaMock() as any,
      );
      registry.onModuleInit();

      expect(registry.hasTool('known_tool')).toBe(true);
      expect(registry.hasTool('ghost_tool')).toBe(false);
    });

    it('returns the schema as-is when it has no $schema key to strip', async () => {
      vi.mocked(zodToJsonSchema).mockReturnValueOnce({ type: 'object' } as any);
      const tool = createFakeTool({ name: 'no_dollar_schema', inputSchema: z.object({}) });
      const registry = new ToolRegistry(
        makeDiscoveryMock([tool]) as any,
        mockReflector('AI_TOOL') as any,
        mockLogging as any,
        makePrismaMock() as any,
      );
      registry.onModuleInit();

      const defs = await registry.getToolDefinitions({ roleName: 'admin' });
      expect(defs[0].inputSchema).toEqual({ type: 'object' });
    });

    it('derives the tool group from the owning Nest module', async () => {
      const tool1 = createFakeTool({ name: 'list_users', inputSchema: z.object({}) });
      const tool2 = createFakeTool({ name: 'ghost_tool', inputSchema: z.object({}) });
      const registry = new ToolRegistry(
        makeDiscoveryMock([tool1, tool2], { list_users: 'UserRouteAccessModule' }) as any,
        mockReflector('AI_TOOL') as any,
        mockLogging as any,
        makePrismaMock() as any,
      );
      registry.onModuleInit();

      expect(registry.getToolGroup('list_users')).toBe('user-route-access');
      expect(registry.getToolGroup('ghost_tool')).toBe('other');
    });

    it('derives the i18n description key from the tool name, honouring an explicit one', async () => {
      const derived = createFakeTool({ name: 'list_users', inputSchema: z.object({}) });
      const explicit = createFakeTool({
        name: 'set_page_layout',
        inputSchema: z.object({}),
        descriptionKey: 'tool_custom_layout',
      });
      const registry = new ToolRegistry(
        makeDiscoveryMock([derived, explicit]) as any,
        mockReflector('AI_TOOL') as any,
        mockLogging as any,
        makePrismaMock() as any,
      );
      registry.onModuleInit();

      expect(registry.getDescriptionKey('list_users')).toBe('tool_list_users');
      expect(registry.getDescriptionKey('set_page_layout')).toBe('tool_custom_layout');
    });

    it('exposes a tool approvalScope without executing anything (getApprovalScope)', async () => {
      const writeTool = createFakeTool({
        name: 'write_tool',
        inputSchema: z.object({}),
        approvalScope: 'users:write',
      });
      const readTool = createFakeTool({ name: 'read_tool', inputSchema: z.object({}) });
      const registry = new ToolRegistry(
        makeDiscoveryMock([writeTool, readTool]) as any,
        mockReflector('AI_TOOL') as any,
        mockLogging as any,
        makePrismaMock() as any,
      );
      registry.onModuleInit();

      expect(registry.getApprovalScope('write_tool')).toBe('users:write');
      expect(registry.getApprovalScope('read_tool')).toBeUndefined();
      expect(registry.getApprovalScope('ghost_tool')).toBeUndefined();
      expect(writeTool.execute).not.toHaveBeenCalled();
    });

    it('excludes tools the user revoked for themselves', async () => {
      const tool1 = createFakeTool({ name: 'tool_a', inputSchema: z.object({}) });
      const tool2 = createFakeTool({ name: 'tool_b', inputSchema: z.object({}) });
      const registry = new ToolRegistry(
        makeDiscoveryMock([tool1, tool2]) as any,
        mockReflector('AI_TOOL') as any,
        mockLogging as any,
        makePrismaMock([{ userId: 'u1', toolName: 'tool_b' }]) as any,
      );
      registry.onModuleInit();

      const defs = await registry.getToolDefinitions({ roleName: 'admin', userId: 'u1' });
      expect(defs).toHaveLength(1);
      expect(defs[0].name).toBe('tool_a');
    });
  });

  describe('dispatch — security rules', () => {
    it('returns ok for valid execution', async () => {
      const tool = createFakeTool({
        name: 'valid_tool',
        inputSchema: z.object({ msg: z.string() }),
        invalidates: ['user'],
      });
      const registry = new ToolRegistry(
        makeDiscoveryMock([tool]) as any,
        mockReflector('AI_TOOL') as any,
        mockLogging as any,
        makePrismaMock() as any,
      );
      registry.onModuleInit();

      const result = await registry.dispatch('valid_tool', { msg: 'hello' }, adminCtx);
      expect(result.status).toBe('ok');
      if (result.status === 'ok') {
        expect(result.invalidates).toEqual(['user']);
        expect(tool.execute).toHaveBeenCalledWith({ msg: 'hello' }, adminCtx);
      }
    });

    it('returns error for unknown tool', async () => {
      const registry = new ToolRegistry(
        makeDiscoveryMock([]) as any,
        mockReflector('AI_TOOL') as any,
        mockLogging as any,
        makePrismaMock() as any,
      );
      registry.onModuleInit();

      const result = await registry.dispatch('ghost', {}, adminCtx);
      expect(result.status).toBe('error');
      if (result.status === 'error') {
        expect(result.message).toContain('Unknown tool');
      }
    });

    it('returns error when role does not match (defesa dupla)', async () => {
      const tool = createFakeTool({
        name: 'admin_tool',
        inputSchema: z.object({}),
        roles: ['admin'],
      });
      const registry = new ToolRegistry(
        makeDiscoveryMock([tool]) as any,
        mockReflector('AI_TOOL') as any,
        mockLogging as any,
        makePrismaMock() as any,
      );
      registry.onModuleInit();

      const result = await registry.dispatch('admin_tool', {}, userCtx);
      expect(result.status).toBe('error');
      if (result.status === 'error') {
        expect(result.message).toContain('Permission denied');
      }
      expect(tool.execute).not.toHaveBeenCalled();
    });

    it('returns approval_required when scope not approved', async () => {
      const tool = createFakeTool({
        name: 'write_tool',
        inputSchema: z.object({}),
        approvalScope: 'users:write',
      });
      const registry = new ToolRegistry(
        makeDiscoveryMock([tool]) as any,
        mockReflector('AI_TOOL') as any,
        mockLogging as any,
        makePrismaMock() as any,
      );
      registry.onModuleInit();

      const result = await registry.dispatch('write_tool', {}, adminCtx);
      expect(result.status).toBe('approval_required');
      if (result.status === 'approval_required') {
        expect(result.scope).toBe('users:write');
      }
      expect(tool.execute).not.toHaveBeenCalled();
    });

    it('executes when approvalScope is approved', async () => {
      const tool = createFakeTool({
        name: 'write_tool',
        inputSchema: z.object({}),
        approvalScope: 'users:write',
      });
      const registry = new ToolRegistry(
        makeDiscoveryMock([tool]) as any,
        mockReflector('AI_TOOL') as any,
        mockLogging as any,
        makePrismaMock() as any,
      );
      registry.onModuleInit();

      const result = await registry.dispatch('write_tool', {}, approvedCtx);
      expect(result.status).toBe('ok');
      expect(tool.execute).toHaveBeenCalled();
    });

    it('returns error on invalid input (safeParse)', async () => {
      const tool = createFakeTool({
        name: 'strict_tool',
        inputSchema: z.object({ id: z.string() }),
      });
      const registry = new ToolRegistry(
        makeDiscoveryMock([tool]) as any,
        mockReflector('AI_TOOL') as any,
        mockLogging as any,
        makePrismaMock() as any,
      );
      registry.onModuleInit();

      const result = await registry.dispatch('strict_tool', { id: 123 }, adminCtx);
      expect(result.status).toBe('error');
      if (result.status === 'error') {
        expect(result.message).toContain('Invalid input');
      }
      expect(tool.execute).not.toHaveBeenCalled();
    });

    it('logs execution on success', async () => {
      const tool = createFakeTool({
        name: 'loggable',
        inputSchema: z.object({}),
      });
      const registry = new ToolRegistry(
        makeDiscoveryMock([tool]) as any,
        mockReflector('AI_TOOL') as any,
        mockLogging as any,
        makePrismaMock() as any,
      );
      registry.onModuleInit();

      await registry.dispatch('loggable', {}, adminCtx);
      expect(mockLogging.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'AI_TOOL_EXECUTED',
          message: expect.stringContaining('loggable'),
        }),
        'u1',
      );
    });

    it('returns error when the user revoked the tool for themselves (defesa dupla)', async () => {
      const tool = createFakeTool({ name: 'revoked_tool', inputSchema: z.object({}) });
      const registry = new ToolRegistry(
        makeDiscoveryMock([tool]) as any,
        mockReflector('AI_TOOL') as any,
        mockLogging as any,
        makePrismaMock([{ userId: 'u1', toolName: 'revoked_tool' }]) as any,
      );
      registry.onModuleInit();

      const result = await registry.dispatch('revoked_tool', {}, adminCtx);
      expect(result.status).toBe('error');
      if (result.status === 'error') {
        expect(result.message).toContain('desabilitada pelo usuário');
      }
      expect(tool.execute).not.toHaveBeenCalled();
    });

    it('returns error when tool.execute throws', async () => {
      const tool = createFakeTool({
        name: 'broken',
        inputSchema: z.object({}),
      });
      (tool.execute as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('exploded'));
      const registry = new ToolRegistry(
        makeDiscoveryMock([tool]) as any,
        mockReflector('AI_TOOL') as any,
        mockLogging as any,
        makePrismaMock() as any,
      );
      registry.onModuleInit();

      const result = await registry.dispatch('broken', {}, adminCtx);
      expect(result.status).toBe('error');
      if (result.status === 'error') {
        expect(result.message).toContain('exploded');
      }
    });
  });
});
