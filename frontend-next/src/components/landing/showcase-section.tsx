'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import { ArtifactFrame } from './artifact-frame';
import { LiquidDistortion } from './liquid-distortion';

export interface ShowcaseSectionProps {
  anchorId?: string;
  label: string;
  title: string;
  description: string;
  mediaPosition?: 'left' | 'right';
  demosInteractive?: boolean;
  demos?: Array<{ url: string; label: string }>;
}

export function ShowcaseSection({
  anchorId = 'showcase',
  label,
  title,
  description,
  mediaPosition = 'right',
  demosInteractive = true,
  demos = [],
}: ShowcaseSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const isMediaLeft = mediaPosition === 'left';

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      const frame = sectionRef.current?.querySelector('.showcase-frame');
      const mm = gsap.matchMedia();

      // Mobile: Clean fade up entrance, no clipping or scrub freezing
      mm.add('(max-width: 767px)', () => {
        gsap.set(['.showcase-label', '.showcase-title', '.showcase-body', '.showcase-frame'], {
          clipPath: 'none',
          opacity: 0,
          y: 20,
        });

        gsap.to(['.showcase-label', '.showcase-title', '.showcase-body', '.showcase-frame'], {
          opacity: 1,
          y: 0,
          stagger: 0.1,
          duration: 0.65,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 85%',
            toggleActions: 'play none none none',
          },
        });
      });

      // Desktop: scrubbed entrance with properly scoped triggers
      mm.add('(min-width: 768px)', () => {
        gsap.set('.showcase-label', { x: isMediaLeft ? 24 : -24 });
        gsap.set('.showcase-title', { clipPath: 'inset(100% -10% 0% -5%)' });
        gsap.set('.showcase-body', { clipPath: 'inset(100% 0 0 0)' });
        gsap.set('.showcase-frame', { y: 60, opacity: 0 });

        gsap.to('.showcase-label', {
          x: 0,
          scrollTrigger: { trigger: sectionRef.current, start: 'top 80%', end: 'top 40%', scrub: 1 },
        });
        gsap.to('.showcase-title', {
          clipPath: 'inset(-15% -10% -15% -5%)',
          scrollTrigger: { trigger: sectionRef.current, start: 'top 75%', end: 'top 25%', scrub: 1.5 },
        });
        gsap.to('.showcase-body', {
          clipPath: 'inset(0% 0 0 0)',
          scrollTrigger: { trigger: sectionRef.current, start: 'top 65%', end: 'top 20%', scrub: 1.5 },
        });
        gsap.to('.showcase-frame', {
          y: 0,
          opacity: 1,
          scrollTrigger: { trigger: frame || sectionRef.current, start: 'top 85%', end: 'top 25%', scrub: 2 },
        });
      });
    }, sectionRef);

    return () => ctx.revert();
  }, [isMediaLeft]);

  return (
    <section
      ref={sectionRef}
      id={anchorId}
      className="relative scroll-mt-24"
      style={{
        background: 'var(--lp-bg)',
        padding: 'clamp(3.5rem, 8vw, 8rem) max(1.5rem, env(safe-area-inset-left,0px)) clamp(4.5rem, 9vw, 9rem)',
      }}
    >
      <div className="mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-2 md:gap-20">
        {/* Frame de demonstração / artefatos */}
        <div className={`mb-6 md:mb-0 ${isMediaLeft ? 'order-2 md:order-1' : 'order-2'}`}>
          <ArtifactFrame
            demos={demos}
            interactive={demosInteractive}
            className="showcase-frame"
            style={{
              transform: isMediaLeft
                ? 'perspective(1200px) rotateX(6deg) rotateY(3deg)'
                : 'perspective(1200px) rotateX(6deg) rotateY(-3deg)',
              transformOrigin: 'center top',
            }}
          />
        </div>

        {/* Coluna de texto */}
        <div className={isMediaLeft ? 'order-1 md:order-2' : 'order-1 md:order-1'}>
          <div
            className="showcase-label mb-5 flex items-center gap-3 text-xs font-medium uppercase tracking-widest sm:mb-7"
            style={{ color: 'var(--lp-muted)' }}
          >
            <span className="font-mono font-black select-none flex-shrink-0" aria-hidden="true">
              {'>'}
            </span>
            {label}
          </div>

          <LiquidDistortion className="mb-5 block w-full max-w-full sm:mb-6">
            <h2
              className="showcase-title font-black leading-[1.05] tracking-tight break-words [overflow-wrap:anywhere]"
              style={{ fontSize: 'clamp(1.85rem, 5vw, 4.25rem)', letterSpacing: '-0.025em', color: 'var(--lp-fg)' }}
            >
              {title}
            </h2>
          </LiquidDistortion>

          <p
            className="showcase-body text-base leading-relaxed"
            style={{ color: 'var(--lp-muted)', maxWidth: '440px' }}
          >
            {description}
          </p>
        </div>
      </div>
    </section>
  );
}
