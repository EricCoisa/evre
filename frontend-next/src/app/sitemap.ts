import type { MetadataRoute } from 'next';
import { getHomeData } from '@/lib/actions/cms/home/api';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const homeData = await getHomeData();

  return [
    {
      url: siteUrl,
      lastModified: homeData?.updatedAt ? new Date(homeData.updatedAt) : new Date(0),
      changeFrequency: 'monthly',
      priority: 1,
    },
  ];
}
