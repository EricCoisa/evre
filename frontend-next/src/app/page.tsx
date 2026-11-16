import type { Metadata } from 'next';
import { getHomeData } from '@/lib/actions/cms/home/api';
import { generateOrganizationSchema } from '@/lib/actions/cms/home/schema';
import { getCaptchaConfig } from '@/lib/actions/captcha/api';
import { HomeClient } from './page/page-client';
import { generateMetadataFromPayload } from '@/lib/seo-helpers';

// Page fetches from Payload CMS at request time — never statically rendered
export const dynamic = 'force-dynamic';

/** Metadata da home derivada do documento do Payload CMS. */
export async function generateMetadata(): Promise<Metadata> {
  const homeData = await getHomeData();

  return generateMetadataFromPayload(
    homeData,
    {
      title: homeData?.heroTitle,
      description: homeData?.heroDescription,
    }
  );
}

export default async function Home() {
  const [homeData, captchaRes] = await Promise.all([
    getHomeData(),
    getCaptchaConfig(),
  ]);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  return (
    <>
      {homeData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(generateOrganizationSchema(homeData, siteUrl)) }}
        />
      )}
      <HomeClient initialData={homeData} captchaConfig={captchaRes.data ?? null} />
    </>
  );
}

