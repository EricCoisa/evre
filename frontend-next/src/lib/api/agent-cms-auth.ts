import { NextRequest, NextResponse } from 'next/server';

/** Gate das rotas `/api/agent/cms/*`: autentica por `AGENT_CMS_SECRET`, nunca por cookie de sessão. */
export function requireAgentSecret(req: NextRequest): NextResponse | null {
  const expected = process.env.AGENT_CMS_SECRET;
  const provided = req.headers.get('x-agent-secret');
  if (!expected || !provided || provided !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
