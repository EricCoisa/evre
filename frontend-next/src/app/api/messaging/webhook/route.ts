import type { NextRequest } from 'next/server';
import { apiTarget, proxyToBackend } from '@/lib/api/mcp-proxy';
import { API_PATHS } from '@/lib/generated/paths';

/** URL do webhook dos providers, proxiada pelo front sob /api/ por exigência do matcher do middleware. */
export const dynamic = 'force-dynamic';

const proxy = (req: NextRequest) =>
  proxyToBackend(
    req,
    apiTarget(API_PATHS.MESSAGING_WEBHOOK, req.nextUrl.search),
  );

export const POST = proxy;
export const GET = proxy;
