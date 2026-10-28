import { describe, it, expect, afterEach } from 'vitest';
import type { NextRequest } from 'next/server';
import { requireAgentSecret } from './agent-cms-auth';

function reqWith(secret: string | null): NextRequest {
  return {
    headers: { get: (key: string) => (key === 'x-agent-secret' ? secret : null) },
  } as unknown as NextRequest;
}

describe('requireAgentSecret', () => {
  const original = process.env.AGENT_CMS_SECRET;

  afterEach(() => {
    process.env.AGENT_CMS_SECRET = original;
  });

  it('rejects when AGENT_CMS_SECRET is not configured', async () => {
    delete process.env.AGENT_CMS_SECRET;

    const res = requireAgentSecret(reqWith('anything'));

    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
    await expect(res!.json()).resolves.toEqual({ error: 'Unauthorized' });
  });

  it('rejects when the request has no secret header', () => {
    process.env.AGENT_CMS_SECRET = 'secret123';

    const res = requireAgentSecret(reqWith(null));

    expect(res?.status).toBe(401);
  });

  it('rejects when the provided secret does not match', () => {
    process.env.AGENT_CMS_SECRET = 'secret123';

    const res = requireAgentSecret(reqWith('wrong'));

    expect(res?.status).toBe(401);
  });

  it('allows the request through (returns null) when the secret matches', () => {
    process.env.AGENT_CMS_SECRET = 'secret123';

    expect(requireAgentSecret(reqWith('secret123'))).toBeNull();
  });
});
