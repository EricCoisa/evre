'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import { defaulHometData } from '@/lib/actions/cms/home/type';
import { ArtifactFrame } from './artifact-frame';

interface SitesSectionProps {
  label?: string;
  title?: string;
  description?: string;
  demos?: Array<{ url: string; label: string }>;
}

export function SitesSection({
  label = defaulHometData.sitesLabel!,
  title = defaulHometData.sitesTitle!,
  description = defaulHometData.sitesDescription!,
  demos = defaulHometData.siteDemos!,
}: SitesSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      gsap.set('.sites-label', { x: -24 });
      gsap.set('.sites-title', { clipPath: 'inset(100% 0 0 0)' });
      gsap.set('.sites-body', { clipPath: 'inset(100% 0 0 0)' });
      gsap.set('.sites-frame', { y: 60, opacity: 0 });

      gsap.to('.sites-label', {
        x: 0,
        scrollTrigger: { trigger: sectionRef.current, start: 'top 80%', end: 'top 40%', scrub: 1 },
      });
      gsap.to('.sites-title', {
        clipPath: 'inset(0% 0 0 0)',
        scrollTrigger: { trigger: sectionRef.current, start: 'top 75%', end: 'top 25%', scrub: 1.5 },
      });
      gsap.to('.sites-body', {
        clipPath: 'inset(0% 0 0 0)',
        scrollTrigger: { trigger: sectionRef.current, start: 'top 65%', end: 'top 20%', scrub: 1.5 },
      });
      gsap.to('.sites-frame', {
        y: 0, opacity: 1,
        scrollTrigger: { trigger: '.sites-frame', start: 'top 85%', end: 'top 25%', scrub: 2 },
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="sites"
      className="relative"
      style={{ background: 'var(--lp-bg)', padding: '10rem max(2rem, env(safe-area-inset-left,0px))' }}
    >
      <div className="mx-auto grid max-w-6xl items-center gap-16 md:grid-cols-2 md:gap-20">
        {/* Text */}
        <div>
          <div
            className="sites-label mb-7 flex items-center gap-3 text-xs font-medium uppercase tracking-widest"
            style={{ color: 'var(--lp-muted)' }}
          >
            <span className="font-mono font-black select-none flex-shrink-0" aria-hidden="true">{'>'}</span>
            {label}
          </div>

          <h2
            className="sites-title mb-6 font-black leading-none tracking-tight whitespace-pre-wrap"
            style={{ fontSize: 'clamp(2rem, 5vw, 4.25rem)', letterSpacing: '-0.025em', color: 'var(--lp-fg)' }}
          >
            {title}
          </h2>

          <p className="sites-body text-base leading-relaxed" style={{ color: 'var(--lp-muted)', maxWidth: '400px' }}>
            {description}
          </p>
        </div>

        <ArtifactFrame
          demos={demos}
          className="sites-frame"
          style={{
            transform: 'perspective(1200px) rotateX(6deg) rotateY(-3deg)',
            transformOrigin: 'center top',
          }}
        />
      </div>
    </section>
  );
}
