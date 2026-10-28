import { NextRequest } from 'next/server';
import { proxyWithSession } from '@/lib/api/session-proxy';
import { API_PATHS } from '@/lib/generated/paths';

export async function POST(req: NextRequest, { params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;
  return proxyWithSession(req, API_PATHS.AI_CONVERSATIONS_BY_ID_MESSAGES(conversationId), {
    forwardBody: true,
  });
}