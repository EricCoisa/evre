import { NextRequest, NextResponse } from 'next/server';
import { requireAgentSecret } from '@/lib/api/agent-cms-auth';
import { describeBlocks } from '@/lib/page-builder/blocks.meta';
import { ALLOWED_CLASS_NAMES } from '@/lib/page-builder/class-names';
import { describePages } from '@/lib/page-builder/pages';
import { SPANS } from '@/lib/page-builder/schema';

/** Catálogo de blocos e páginas do PageBuilder, servido ao backend via x-agent-secret. */
export async function GET(req: NextRequest) {
  const unauthorized = requireAgentSecret(req);
  if (unauthorized) return unauthorized;

  return NextResponse.json({
    blocks: describeBlocks(),
    pages: describePages(),
    spans: [...SPANS],
    // Lista fechada de classNames Tailwind permitidos
    classNames: [...ALLOWED_CLASS_NAMES],
  });
}
