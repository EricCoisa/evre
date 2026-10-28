import type { NextRequest } from 'next/server';
import { apiTarget, proxyToBackend } from '@/lib/api/mcp-proxy';

/** Proxy catch-all do Authorization Server OAuth do conector MCP para o backend. */
export const dynamic = 'force-dynamic';

async function proxy(
  req: NextRequest,
  { params }: { params: Promise<{ segments: string[] }> },
) {
  const { segments } = await params;
  return proxyToBackend(
    req,
    apiTarget(`/oauth/${segments.join('/')}`, req.nextUrl.search),
  );
}

export const GET = proxy;
export const POST = proxy;
