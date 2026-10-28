import type { NextRequest } from 'next/server';
import { proxyWithSession } from '@/lib/api/session-proxy';
import { API_PATHS } from '@/lib/generated/paths';

/** Expõe o stream SSE de mudanças de mensageria, convertendo o cookie de sessão em Bearer. */
export const dynamic = 'force-dynamic';

export const GET = (req: NextRequest) => proxyWithSession(req, API_PATHS.MESSAGING_EVENTS);
