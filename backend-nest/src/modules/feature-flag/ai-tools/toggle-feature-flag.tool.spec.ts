import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToggleFeatureFlagTool } from './toggle-feature-flag.tool';
import type { UpdateFeatureFlagUseCase } from '../use-cases/update.use-case';
import type { AiToolContext } from 'src/domain/ai/ai-tool.types';
import { McpScopes } from 'src/domain/api-key/mcp-scopes.const';

const mockService = { execute: vi.fn() } as unknown as UpdateFeatureFlagUseCase;
const ctx = { userId: 'u1', roleName: 'ADMIN', approvedScopes: [McpScopes.FEATURE_FLAGS_WRITE] } satisfies AiToolContext;

describe('ToggleFeatureFlagTool', () => {
  let tool: ToggleFeatureFlagTool;

  beforeEach(() => {
    vi.clearAllMocks();
    tool = new ToggleFeatureFlagTool(mockService);
  });

  it('definition is well-formed', () => {
    expect(tool.definition.name).toBe('toggle_feature_flag');
    expect(tool.definition.roles).toContain('ADMIN');
    expect(tool.definition.inputSchema).toBeDefined();
  });

  it('approvalScope and invalidates are set (human-in-the-loop contract)', () => {
    expect(tool.definition.approvalScope).toBe(McpScopes.FEATURE_FLAGS_WRITE);
    expect(tool.definition.invalidates).toContain('feature-flags');
  });

  it('execute delegates to service.update with correct args', async () => {
    mockService.execute = vi.fn().mockResolvedValue({ id: 'f1', enabled: false });
    await tool.execute({ id: 'f1', enabled: false }, ctx);
    expect(mockService.execute).toHaveBeenCalledWith('f1', { enabled: false });
  });
});
