'use client';

import { useState } from 'react';
import { RichText } from '@payloadcms/richtext-lexical/react';
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical';
import { usePreviewPolling } from '@/hooks/use-preview-polling';
import { getLegalPage } from '@/lib/actions/cms/legal/api';
import type { LegalPageData } from '@/lib/actions/cms/legal/type';

export function LegalPageClient({ initialData }: { initialData: LegalPageData }) {
  const [page, setPage] = useState<LegalPageData>(initialData);

  usePreviewPolling(async () => {
    // Só executa quando ?preview=true (ver usePreviewPolling) — drafts são seguros aqui.
    const data = await getLegalPage(initialData.slug, { includeDrafts: true });
    if (data) setPage(data);
  });

  return (
    <article className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="mb-8 text-3xl font-bold">{page.title}</h1>
      <div className="prose dark:prose-invert max-w-none">
        <RichText data={page.content as SerializedEditorState} />
      </div>
    </article>
  );
}
