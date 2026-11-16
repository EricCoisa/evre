import type { Metadata } from 'next';
import { getHomeData } from '@/lib/actions/cms/home/api';
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
      description: homeData?.sitesDescription,
    }
  );
}

export default async function Home() {
  const [homeData, captchaRes] = await Promise.all([
    getHomeData(),
    getCaptchaConfig(),
  ]);

  return <HomeClient initialData={homeData} captchaConfig={captchaRes.data ?? null} />;
}

