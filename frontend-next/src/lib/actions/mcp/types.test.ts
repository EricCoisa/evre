import { describe, it, expect } from 'vitest';
import { MCP_SCOPES } from './types';
import { MCP_SCOPES as MCP_SCOPES_SOURCE } from '../api-keys/types';

describe('MCP_SCOPES re-export', () => {
  it('is the same list exported by api-keys/types', () => {
    expect(MCP_SCOPES).toBe(MCP_SCOPES_SOURCE);
  });
});
