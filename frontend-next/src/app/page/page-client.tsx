'use client';

import { useState } from 'react';
import { HomeData, defaulHometData } from '@/lib/actions/cms/home/type';
import { usePreviewPolling } from '@/hooks/use-preview-polling';
import { getHomeData } from '@/lib/actions/cms/home/api';
import type { CaptchaConfigDto } from '@/lib/generated/schemas';

import { LandingNav } from '@/components/landing/landing-nav';
import { HeroSection } from '@/components/landing/hero-section';
import { ShowcaseSection } from '@/components/landing/showcase-section';
import { EquipesSection } from '@/components/landing/equipes-section';
import { FinalCtaSection } from '@/components/landing/final-cta-section';
import { LandingFooter } from '@/components/landing/landing-footer';

interface HomeClientProps {
  initialData: HomeData | null;
  captchaConfig: CaptchaConfigDto | null;
}

export function HomeClient({ initialData, captchaConfig }: HomeClientProps) {
  const [homeData, setHomeData] = useState<HomeData | null>(initialData);

  usePreviewPolling(async () => {
    const data = await getHomeData();
    setHomeData(data);
  });

  const content = {
    ...defaulHometData,
    ...(homeData || {}),
  } as HomeData;

  const sections = content.sections || defaulHometData.sections || [];

  const navItems = sections.map((section) => ({
    href: `#${section.anchorId}`,
    label: section.navLabel || section.label.split('&')[0].trim(),
    mobileLabel: section.label,
  }));

  return (
    <div
      className="flex min-h-screen flex-col selection:bg-foreground selection:text-background"
      style={{ background: 'var(--lp-bg)', color: 'var(--lp-fg)' }}
    >
      <LandingNav whatsappNumber={content.heroWhatsappNumber} navItems={navItems} />

      <main className="flex flex-1 flex-col">
        <HeroSection
          title={content.heroTitle}
          description={content.heroDescription}
          cta={content.heroCta}
          whatsappNumber={content.heroWhatsappNumber}
        />

        {sections.map((section, index) => {
          const key = section.id || `${section.blockType}-${section.anchorId || index}`;

          if (section.blockType === 'showcase') {
            return (
              <ShowcaseSection
                key={key}
                anchorId={section.anchorId}
                label={section.label}
                title={section.title}
                description={section.description}
                mediaPosition={section.mediaPosition}
                demosInteractive={section.demosInteractive}
                demos={section.demos}
              />
            );
          }

          if (section.blockType === 'cardsGrid') {
            return (
              <EquipesSection
                key={key}
                anchorId={section.anchorId}
                label={section.label}
                title={section.title}
                description={section.description}
                cards={section.cards}
              />
            );
          }

          return null;
        })}

        <FinalCtaSection
          title={content.ctaTitle}
          buttonText={content.ctaButtonText}
          whatsappNumber={content.heroWhatsappNumber}
          contactEmail={content.contactEmail}
          contactFormLabel={content.contactFormLabel}
          contactFormTitle={content.contactFormTitle}
          contactFormDescription={content.contactFormDescription}
          contactFormButtonText={content.contactFormButtonText}
          contactFormSuccessMessage={content.contactFormSuccessMessage}
          captcha={captchaConfig}
        />
      </main>

      <LandingFooter footerText={content.footerText} />
    </div>
  );
}
