import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLegalPage } from '@/lib/actions/cms/legal/api';
import { generateMetadataFromPayload } from '@/lib/seo-helpers';
import { LegalPageClient } from './legal-page-client';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = await getLegalPage(slug);

  return generateMetadataFromPayload(page, { title: page?.title });
}

export default async function LegalPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { slug } = await params;
  const { preview } = await searchParams;
  const page = await getLegalPage(slug, { includeDrafts: preview === 'true' });

  if (!page) notFound();

  return <LegalPageClient initialData={page} />;
}
