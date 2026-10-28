import type { NextRequest } from 'next/server';
import { proxyToBackend, rootTarget } from '@/lib/api/mcp-proxy';

/** Proxy dos documentos de descoberta OAuth (RFC 9728/8414) para a raiz do backend. */
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ segments: string[] }> },
) {
  const { segments } = await params;
  return proxyToBackend(
    req,
    rootTarget(`/.well-known/${segments.join('/')}`, req.nextUrl.search),
  );
}
