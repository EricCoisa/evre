import type { NextRequest } from 'next/server';
import { proxyWithSession } from '@/lib/api/session-proxy';
import { API_PATHS } from '@/lib/generated/paths';

/** Serve a foto de perfil do contato para <img>, buscando no WhatsApp a cada pedido. */
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyWithSession(req, API_PATHS.MESSAGING_CONTACTS_BY_ID_PHOTO(id));
}
