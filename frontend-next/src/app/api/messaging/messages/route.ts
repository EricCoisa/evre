import type { NextRequest } from 'next/server';
import { proxyWithSession } from '@/lib/api/session-proxy';
import { API_PATHS } from '@/lib/generated/paths';

/** Recebe o envio de mensagem com anexo via multipart/form-data; texto e template seguem pela server action. */
export const dynamic = 'force-dynamic';

export const POST = (req: NextRequest) =>
  proxyWithSession(req, API_PATHS.MESSAGING_MESSAGES, { forwardBody: true });
