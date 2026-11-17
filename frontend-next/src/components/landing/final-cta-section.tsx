'use client';

import { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import { defaulHometData } from '@/lib/actions/cms/home/type';
import { makeWhatsappUrl } from './utils';
import { ContactFormDialog } from '@/components/landing/contact-form-dialog';
import { LiquidDistortion } from '@/components/landing/liquid-distortion';
import type { CaptchaConfigDto } from '@/lib/generated/schemas';

interface FinalCtaSectionProps {
  title?: string;
  buttonText?: string;
  whatsappNumber?: string;
  contactFormLabel?: string;
  contactFormTitle?: string;
  contactFormDescription?: string;
  contactFormButtonText?: string;
  contactFormSuccessMessage?: string;
  captcha?: CaptchaConfigDto | null;
}

export function FinalCtaSection({
  title = defaulHometData.ctaTitle!,
  buttonText = defaulHometData.ctaButtonText!,
  whatsappNumber = defaulHometData.heroWhatsappNumber!,
  contactFormLabel = defaulHometData.contactFormLabel!,
  contactFormTitle = defaulHometData.contactFormTitle!,
  contactFormDescription = defaulHometData.contactFormDescription!,
  contactFormButtonText = defaulHometData.contactFormButtonText!,
  contactFormSuccessMessage = defaulHometData.contactFormSuccessMessage!,
  captcha,
}: FinalCtaSectionProps) {
  const [formOpen, setFormOpen] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const whatsappUrl = makeWhatsappUrl(whatsappNumber);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      // Mobile: Clean fade up entrance, no clipping or scrub freezing
      mm.add('(max-width: 767px)', () => {
        gsap.set('.cta-title', { clipPath: 'none', opacity: 0, y: 20 });
        gsap.set('.cta-actions', { opacity: 0, y: 20 });

        gsap.to('.cta-title', {
          opacity: 1,
          y: 0,
          duration: 0.65,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 85%',
            toggleActions: 'play none none none',
          },
        });

        gsap.to('.cta-actions', {
          opacity: 1,
          y: 0,
          duration: 0.65,
          delay: 0.1,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: sectionRef.current?.querySelector('.cta-actions') || sectionRef.current,
            start: 'top 85%',
            toggleActions: 'play none none none',
          },
        });
      });

      // Desktop: scrubbed entrance
      mm.add('(min-width: 768px)', () => {
        gsap.set('.cta-title', { clipPath: 'inset(100% -15% 0% -5%)' });
        gsap.set('.cta-actions', { opacity: 0, y: 20 });

        gsap.to('.cta-title', {
          clipPath: 'inset(-15% -15% -15% -5%)',
          scrollTrigger: { trigger: sectionRef.current, start: 'top 75%', end: 'top 20%', scrub: 1.5 },
        });
        gsap.to('.cta-actions', {
          opacity: 1,
          y: 0,
          scrollTrigger: {
            trigger: sectionRef.current?.querySelector('.cta-actions') || sectionRef.current,
            start: 'top 85%',
            end: 'top 55%',
            scrub: 1,
          },
        });
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="contato"
      className="relative overflow-hidden scroll-mt-24"
      style={{ background: 'var(--lp-bg)', padding: 'clamp(3.5rem, 8vw, 8rem) max(1.5rem, env(safe-area-inset-left,0px)) clamp(3rem, 7vw, 8rem)' }}
    >
      {/* Divider line */}
      <div className="mx-auto mb-14 max-w-6xl sm:mb-20" style={{ height: '1px', background: 'var(--lp-border)' }} />

      <div className="mx-auto max-w-6xl">
        <LiquidDistortion className="mb-10 block w-fit max-w-full sm:mb-16" strength={32} radius={110}>
          <h2
            className="cta-title font-black leading-none tracking-tight whitespace-pre-wrap"
            style={{
              fontSize: 'clamp(2.25rem, 8.5vw, 10.5rem)',
              letterSpacing: '-0.03em',
              color: 'var(--lp-fg)',
            }}
          >
            {title}
          </h2>
        </LiquidDistortion>

        <div className="cta-actions flex flex-col sm:flex-row items-stretch sm:items-center gap-4 sm:gap-5">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2.5 rounded-sm px-8 py-4 text-sm font-bold tracking-wide transition-opacity hover:opacity-85 text-center w-full sm:w-auto"
            style={{ background: 'var(--lp-fg)', color: 'var(--lp-bg)' }}
          >
            {buttonText}
          </a>

          <button
            onClick={() => setFormOpen(true)}
            className="inline-flex items-center justify-center gap-2.5 rounded-sm px-8 py-4 text-sm font-bold tracking-wide transition-opacity hover:opacity-70 text-center w-full sm:w-auto"
            style={{ border: '1px solid var(--lp-border)', color: 'var(--lp-muted)' }}
          >
            {contactFormLabel}
          </button>

          <ContactFormDialog
            open={formOpen}
            onOpenChange={setFormOpen}
            title={contactFormTitle}
            description={contactFormDescription}
            submitLabel={contactFormButtonText}
            successMessage={contactFormSuccessMessage}
            captcha={captcha}
          />

        </div>
      </div>
    </section>
  );
}
