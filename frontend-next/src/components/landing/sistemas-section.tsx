'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import { defaulHometData } from '@/lib/actions/cms/home/type';
import { ArtifactFrame } from './artifact-frame';

interface SistemasSectionProps {
  label?: string;
  title?: string;
  description?: string;
  demos?: Array<{ url: string; label: string }>;
}

export function SistemasSection({
  label = defaulHometData.sistemasLabel!,
  title = defaulHometData.sistemasTitle!,
  description = defaulHometData.sistemasDescription!,
  demos = defaulHometData.sistemaDemos!,
}: SistemasSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      gsap.set('.sistemas-label', { x: 24 });
      gsap.set('.sistemas-title', { clipPath: 'inset(100% 0 0 0)' });
      gsap.set('.sistemas-body', { clipPath: 'inset(100% 0 0 0)' });
      gsap.set('.sistemas-frame', { y: 60, opacity: 0 });

      gsap.to('.sistemas-label', {
        x: 0,
        scrollTrigger: { trigger: sectionRef.current, start: 'top 80%', end: 'top 40%', scrub: 1 },
      });
      gsap.to('.sistemas-title', {
        clipPath: 'inset(0% 0 0 0)',
        scrollTrigger: { trigger: sectionRef.current, start: 'top 75%', end: 'top 25%', scrub: 1.5 },
      });
      gsap.to('.sistemas-body', {
        clipPath: 'inset(0% 0 0 0)',
        scrollTrigger: { trigger: sectionRef.current, start: 'top 65%', end: 'top 20%', scrub: 1.5 },
      });
      gsap.to('.sistemas-frame', {
        y: 0, opacity: 1,
        scrollTrigger: { trigger: '.sistemas-frame', start: 'top 85%', end: 'top 25%', scrub: 2 },
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="sistemas"
      className="relative"
      style={{ background: 'var(--lp-bg)', padding: '10rem max(2rem, env(safe-area-inset-left,0px))' }}
    >
      <div className="mx-auto grid max-w-6xl items-center gap-16 md:grid-cols-2 md:gap-20">
        <ArtifactFrame
          demos={demos}
          className="sistemas-frame order-2 md:order-1"
          style={{
            transform: 'perspective(1200px) rotateX(6deg) rotateY(3deg)',
            transformOrigin: 'center top',
          }}
        />

        {/* Text — right column */}
        <div className="order-1 md:order-2">
          <div
            className="sistemas-label mb-7 flex items-center gap-3 text-xs font-medium uppercase tracking-widest"
            style={{ color: 'var(--lp-muted)' }}
          >
            <span className="font-mono font-black select-none flex-shrink-0" aria-hidden="true">{'>'}</span>
            {label}
          </div>

          <h2
            className="sistemas-title mb-6 font-black leading-none tracking-tight whitespace-pre-wrap"
            style={{ fontSize: 'clamp(2rem, 5vw, 4.25rem)', letterSpacing: '-0.025em', color: 'var(--lp-fg)' }}
          >
            {title}
          </h2>

          <p className="sistemas-body text-base leading-relaxed" style={{ color: 'var(--lp-muted)', maxWidth: '400px' }}>
            {description}
          </p>
        </div>
      </div>
    </section>
  );
}
