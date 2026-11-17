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
        scrollTrigger: { trigger: '.showcase-frame', start: 'top 85%', end: 'top 25%', scrub: 2 },
      });
    }, sectionRef);

    return () => ctx.revert();
  }, [isMediaLeft]);

  return (
    <section
      ref={sectionRef}
      id={anchorId}
      className="relative"
      style={{
        background: 'var(--lp-bg)',
        padding: 'clamp(4rem, 10vw, 10rem) max(2rem, env(safe-area-inset-left,0px))',
      }}
    >
      <div className="mx-auto grid max-w-6xl items-center gap-16 md:grid-cols-2 md:gap-20">
        {/* Frame de demonstração / artefatos */}
        <div className={isMediaLeft ? 'order-2 md:order-1' : 'order-2 md:order-2'}>
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
            className="showcase-label mb-7 flex items-center gap-3 text-xs font-medium uppercase tracking-widest"
            style={{ color: 'var(--lp-muted)' }}
          >
            <span className="font-mono font-black select-none flex-shrink-0" aria-hidden="true">
              {'>'}
            </span>
            {label}
          </div>

          <LiquidDistortion className="mb-6 block w-fit">
            <h2
              className="showcase-title font-black leading-none tracking-tight whitespace-pre-wrap"
              style={{ fontSize: 'clamp(2rem, 5vw, 4.25rem)', letterSpacing: '-0.025em', color: 'var(--lp-fg)' }}
            >
              {title}
            </h2>
          </LiquidDistortion>

          <p
            className="showcase-body text-base leading-relaxed"
            style={{ color: 'var(--lp-muted)', maxWidth: '400px' }}
          >
            {description}
          </p>
        </div>
      </div>
    </section>
  );
}
