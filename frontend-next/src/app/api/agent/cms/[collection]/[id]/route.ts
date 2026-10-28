import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';
import type { CollectionSlug } from 'payload';
import { requireAgentSecret } from '@/lib/api/agent-cms-auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ collection: string; id: string }> },
) {
  const unauthorized = requireAgentSecret(req);
  if (unauthorized) return unauthorized;

  const { collection, id } = await params;
  const payload = await getPayload({ config });

  try {
    const doc = await payload.findByID({
      collection: collection as CollectionSlug,
      id,
      overrideAccess: true,
    });
    return NextResponse.json(doc);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 400 },
    );
  }
}

// Escrita sem schema fixo: a validação de campo é a do próprio Payload.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ collection: string; id: string }> },
) {
  const unauthorized = requireAgentSecret(req);
  if (unauthorized) return unauthorized;

  const { collection, id } = await params;
  const data = (await req.json()) as Record<string, unknown>;
  const payload = await getPayload({ config });

  try {
    const doc = await payload.update({
      collection: collection as CollectionSlug,
      id,
      data,
      overrideAccess: true,
    });
    return NextResponse.json(doc);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 400 },
    );
  }
}
