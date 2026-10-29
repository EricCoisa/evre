import { NextRequest, NextResponse } from 'next/server';
import { requireAgentSecret } from '@/lib/api/agent-cms-auth';
import { describeBlocks } from '@/lib/page-builder/blocks.meta';
import { classNamesFor } from '@/lib/page-builder/class-names';
import { describePages } from '@/lib/page-builder/pages';
import {
  DEFAULT_PROFILE,
  LAYOUT_PROFILES,
  isLayoutProfileName,
} from '@/lib/page-builder/profiles';
import { SPANS } from '@/lib/page-builder/schema';

/** Catálogo de blocos e páginas do PageBuilder, servido ao backend via x-agent-secret. */
export async function GET(req: NextRequest) {
  const unauthorized = requireAgentSecret(req);
  if (unauthorized) return unauthorized;

  const raw = req.nextUrl.searchParams.get('profile');
  // Profile desconhecido é recusado em vez de ignorado: ignorar devolveria o catálogo inteiro
  // e um typo no nome alargaria a allowlist do validador em silêncio.
  if (raw !== null && !isLayoutProfileName(raw)) {
    return NextResponse.json(
      {
        message: `profile "${raw}" não existe. Disponíveis: ${Object.keys(LAYOUT_PROFILES).join(', ')}.`,
      },
      { status: 400 },
    );
  }
  const profile = raw ?? undefined;

  return NextResponse.json({
    blocks: describeBlocks(profile),
    pages: describePages(),
    spans: [...SPANS],
    // Lista fechada de classNames Tailwind permitidos no profile
    classNames: classNamesFor(profile),
    // Mecanismo de dado desta superfície: "role-filtered" (fonte real), "inline-only" (payload
    // colado em data.inline) ou "none" (nenhum dado). Resposta autodescritiva — o backend já tem
    // o mesmo valor no próprio LAYOUT_PROFILES e não depende deste campo para decidir nada.
    dataSources: LAYOUT_PROFILES[profile ?? DEFAULT_PROFILE].dataSources,
  });
}
