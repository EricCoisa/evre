'use client';

import { useState } from 'react';
import { HomeData, defaulHometData } from '@/lib/actions/cms/home/type';
import { usePreviewPolling } from '@/hooks/use-preview-polling';
import { getHomeData } from '@/lib/actions/cms/home/api';

import { LandingNav } from '@/components/landing/landing-nav';
import { HeroSection } from '@/components/landing/hero-section';
import { SitesSection } from '@/components/landing/sites-section';
import { SistemasSection } from '@/components/landing/sistemas-section';
import { EquipesSection } from '@/components/landing/equipes-section';
import { FinalCtaSection } from '@/components/landing/final-cta-section';
import { LandingFooter } from '@/components/landing/landing-footer';

interface HomeClientProps {
  initialData: HomeData | null;
}

export function HomeClient({ initialData }: HomeClientProps) {
  const [homeData, setHomeData] = useState<HomeData | null>(initialData);

  usePreviewPolling(async () => {
    const data = await getHomeData();
    setHomeData(data);
  });

  const content = {
    ...defaulHometData,
    ...(homeData || {}),
  } as HomeData;

  return (
    <div
      className="flex min-h-screen flex-col selection:bg-foreground selection:text-background"
      style={{ background: 'var(--lp-bg)', color: 'var(--lp-fg)' }}
    >
      <LandingNav whatsappNumber={content.heroWhatsappNumber} />

      <main className="flex flex-1 flex-col">
        <HeroSection
          title={content.heroTitle}
          description={content.heroDescription}
          cta={content.heroCta}
          whatsappNumber={content.heroWhatsappNumber}
        />

        <SitesSection
          label={content.sitesLabel}
          title={content.sitesTitle}
          description={content.sitesDescription}
          demos={content.siteDemos}
        />

        <SistemasSection
          label={content.sistemasLabel}
          title={content.sistemasTitle}
          description={content.sistemasDescription}
          demos={content.sistemaDemos}
        />

        <EquipesSection
          label={content.reforcosLabel}
          title={content.reforcosTitle}
          description={content.reforcosDescription}
          cards={content.equipesCards}
        />

        <FinalCtaSection
          title={content.ctaTitle}
          buttonText={content.ctaButtonText}
          whatsappNumber={content.heroWhatsappNumber}
          contactEmail={content.contactEmail}
        />
      </main>

      <LandingFooter footerText={content.footerText} />
    </div>
  );
}
