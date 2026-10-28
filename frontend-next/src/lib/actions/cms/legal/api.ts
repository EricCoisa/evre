"use server";
import { getPayload } from 'payload';
import config from '@payload-config';
import { LegalPageData } from './type';

export async function getLegalPage(
  slug: string,
  options?: { includeDrafts?: boolean },
): Promise<LegalPageData | null> {
  try {
    const payload = await getPayload({ config });

    const result = await payload.find({
      collection: 'legal-pages',
      where: options?.includeDrafts
        ? { slug: { equals: slug } }
        : { slug: { equals: slug }, published: { equals: true } },
      limit: 1,
    });

    return (result.docs?.[0] as unknown as LegalPageData) ?? null;
  } catch {
    return null;
  }
}
