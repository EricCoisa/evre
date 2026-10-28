import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/api/session-proxy', () => ({
  proxyWithSession: vi.fn().mockResolvedValue(new Response(null, { status: 200 })),
}));

import { proxyWithSession } from '@/lib/api/session-proxy';
import { POST } from './route';

const mockedProxy = vi.mocked(proxyWithSession);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/agent/[conversationId]/approvals', () => {
  it('repassa pela ponte com o corpo, para o endpoint de aprovações da conversa', async () => {
    const req = new NextRequest('http://localhost/api/agent/conv-1/approvals', { method: 'POST' });

    await POST(req, { params: Promise.resolve({ conversationId: 'conv-1' }) });

    expect(mockedProxy).toHaveBeenCalledWith(req, '/ai/conversations/conv-1/approvals', {
      forwardBody: true,
    });
  });
});
