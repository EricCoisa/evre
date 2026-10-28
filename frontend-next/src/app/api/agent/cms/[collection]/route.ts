import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';
import type { CollectionSlug } from 'payload';
import { requireAgentSecret } from '@/lib/api/agent-cms-auth';

// collection vem do agente (string dinâmica) — o próprio Payload valida se existe;
// o cast pra CollectionSlug é só pra satisfazer o TS, nunca reduz o conjunto aceito.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ collection: string }> },
) {
  const unauthorized = requireAgentSecret(req);
  if (unauthorized) return unauthorized;

  const { collection } = await params;
  const { searchParams } = req.nextUrl;
  const limit = Number(searchParams.get('limit') ?? 10);
  const page = Number(searchParams.get('page') ?? 1);

  const payload = await getPayload({ config });

  try {
    const result = await payload.find({
      collection: collection as CollectionSlug,
      limit,
      page,
      overrideAccess: true,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 400 },
    );
  }
}
