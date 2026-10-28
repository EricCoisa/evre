import type { NextRequest } from 'next/server';
import { apiTarget, proxyToBackend } from '@/lib/api/mcp-proxy';

/** `https://<front>/mcp` — a URL que o usuário cola no cliente MCP. Ver docs/backend/mcp.md. */
export const dynamic = 'force-dynamic';

const proxy = (req: NextRequest) => proxyToBackend(req, apiTarget('/mcp'));

export const POST = proxy;
// O backend responde 405 no GET (sem stream SSE) e 204 no DELETE (sem sessão);
// repassar é mais honesto que responder aqui e divergir dele.
export const GET = proxy;
export const DELETE = proxy;
