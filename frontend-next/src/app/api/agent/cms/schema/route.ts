import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';
import { requireAgentSecret } from '@/lib/api/agent-cms-auth';

interface SchemaField {
  name: string;
  type: string;
  required: boolean;
}

// Só campos de topo (name/type/required); campo aninhado aparece com o tipo do container.
export async function GET(req: NextRequest) {
  const unauthorized = requireAgentSecret(req);
  if (unauthorized) return unauthorized;

  const payload = await getPayload({ config });

  const collections = payload.config.collections.map((collection) => ({
    slug: collection.slug,
    fields: collection.fields
      .filter(
        (field): field is typeof field & { name: string } =>
          'name' in field && typeof field.name === 'string',
      )
      .map(
        (field): SchemaField => ({
          name: field.name,
          type: field.type,
          required: 'required' in field ? Boolean(field.required) : false,
        }),
      ),
  }));

  return NextResponse.json({ collections });
}
