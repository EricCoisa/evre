'use client';

import { useState } from 'react';
import { HomeData, defaulHometData } from '@/lib/actions/cms/home/type';
import { usePreviewPolling } from '@/hooks/use-preview-polling';
import { getHomeData } from '@/lib/actions/cms/home/api';

import { LandingNav } from '@/components/landing/landing-nav';
import { HeroSection } from '@/components/landing/hero-section';
import { SolutionsBento } from '@/components/landing/solutions-bento';
import { ProcessTriadSection } from '@/components/landing/process-triad-section';
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

  // Fallback seguro com defaulHometData
  const content = {
    ...defaulHometData,
    ...(homeData || {}),
  } as HomeData;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground selection:bg-foreground selection:text-background transition-colors duration-200">
      {/* Navigation */}
      <LandingNav whatsappNumber={content.heroWhatsappNumber} />

      {/* Main Content */}
      <main className="flex flex-1 flex-col">
        {/* 1. Hero Section */}
        <HeroSection
          title={content.heroTitle}
          description={content.heroDescription}
          primaryButtonText={content.heroPrimaryButtonText}
          secondaryButtonText={content.heroSecondaryButtonText}
          whatsappNumber={content.heroWhatsappNumber}
        />

        {/* 2. Serviços / O que Desenvolvemos (3 Cards) */}
        <SolutionsBento
          title={content.servicesTitle}
          description={content.servicesDescription}
          services={content.services}
        />

        {/* 3. Como Trabalhamos (A Tríade < / >) */}
        <ProcessTriadSection
          title={content.processTitle}
          description={content.processDescription}
          steps={content.processSteps}
        />

        {/* 4. Contato Direto */}
        <FinalCtaSection
          title={content.ctaTitle}
          description={content.ctaDescription}
          whatsappButtonText={content.ctaWhatsappButtonText}
          whatsappNumber={content.heroWhatsappNumber}
          contactEmail={content.contactEmail}
        />
      </main>

      {/* Footer */}
      <LandingFooter footerText={content.footerText} />
    </div>
  );
}
