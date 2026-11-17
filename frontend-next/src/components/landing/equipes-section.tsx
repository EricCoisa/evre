'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import { defaulHometData, CardsGridSectionBlock } from '@/lib/actions/cms/home/type';
import { LiquidDistortion } from './liquid-distortion';

export interface EquipesSectionProps {
  anchorId?: string;
  label?: string;
  title?: string;
  description?: string;
  cards?: Array<{ title: string; description: string }>;
}

const defaultSection = defaulHometData.sections![2] as CardsGridSectionBlock;

export function EquipesSection({
  anchorId = defaultSection.anchorId,
  label = defaultSection.label,
  title = defaultSection.title,
  description = defaultSection.description,
  cards = defaultSection.cards,
}: EquipesSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      // Mobile: Clean fade up entrance, no clipping or scrub freezing
      mm.add('(max-width: 767px)', () => {
        gsap.set(['.equipes-label', '.equipes-title', '.equipes-body'], {
          clipPath: 'none',
          opacity: 0,
          y: 20,
        });
        gsap.set('.equipes-card', { opacity: 0, y: 24 });

        gsap.to(['.equipes-label', '.equipes-title', '.equipes-body'], {
          opacity: 1,
          y: 0,
          stagger: 0.1,
          duration: 0.6,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 85%',
            toggleActions: 'play none none none',
          },
        });

        gsap.to('.equipes-card', {
          opacity: 1,
          y: 0,
          stagger: 0.12,
          duration: 0.6,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: sectionRef.current?.querySelector('.equipes-grid') || sectionRef.current,
            start: 'top 85%',
            toggleActions: 'play none none none',
          },
        });
      });

      // Desktop: scrubbed entrance
      mm.add('(min-width: 768px)', () => {
        gsap.set('.equipes-label', { x: -24 });
        gsap.set('.equipes-title', { clipPath: 'inset(100% -10% 0% -5%)' });
        gsap.set('.equipes-body', { clipPath: 'inset(100% 0 0 0)' });
        gsap.set('.equipes-card', { y: 40, opacity: 0 });

        gsap.to('.equipes-label', {
          x: 0,
          scrollTrigger: { trigger: sectionRef.current, start: 'top 80%', end: 'top 40%', scrub: 1 },
        });
        gsap.to('.equipes-title', {
          clipPath: 'inset(-15% -10% -15% -5%)',
          scrollTrigger: { trigger: sectionRef.current, start: 'top 75%', end: 'top 25%', scrub: 1.5 },
        });
        gsap.to('.equipes-body', {
          clipPath: 'inset(0% 0 0 0)',
          scrollTrigger: { trigger: sectionRef.current, start: 'top 65%', end: 'top 20%', scrub: 1.5 },
        });
        gsap.to('.equipes-card', {
          y: 0, opacity: 1,
          stagger: 0.08,
          scrollTrigger: {
            trigger: sectionRef.current?.querySelector('.equipes-grid') || sectionRef.current,
            start: 'top 80%',
            end: 'top 20%',
            scrub: 2,
          },
        });
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const symbols = ['>', '/', '<'];
  const cells = (cards ?? []).map((card, i) => ({ symbol: symbols[i % symbols.length], ...card }));

  return (
    <section
      ref={sectionRef}
      id={anchorId}
      className="relative overflow-hidden scroll-mt-24"
      style={{ background: 'var(--lp-bg)', padding: 'clamp(3.5rem, 8vw, 8rem) max(1.5rem, env(safe-area-inset-left,0px)) clamp(4.5rem, 9vw, 9rem)' }}
    >
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-12 max-w-2xl sm:mb-20">
          <div
            className="equipes-label mb-5 flex items-center gap-3 text-xs font-medium uppercase tracking-widest sm:mb-7"
            style={{ color: 'var(--lp-muted)' }}
          >
            <span className="font-mono font-black select-none flex-shrink-0" aria-hidden="true">{'>'}</span>
            {label}
          </div>

          <LiquidDistortion className="mb-5 block w-full max-w-full sm:mb-6">
            <h2
              className="equipes-title font-black leading-[1.05] tracking-tight break-words [overflow-wrap:anywhere]"
              style={{ fontSize: 'clamp(1.85rem, 5vw, 4.25rem)', letterSpacing: '-0.025em', color: 'var(--lp-fg)' }}
            >
              {title}
            </h2>
          </LiquidDistortion>

          <p className="equipes-body text-base leading-relaxed" style={{ color: 'var(--lp-muted)', maxWidth: '480px' }}>
            {description}
          </p>
        </div>

        {/* 3-cell grid */}
        <div className="equipes-grid grid gap-5 md:grid-cols-3">
          {cells.map((cell, i) => (
            <div
              key={i}
              className="equipes-card group relative overflow-hidden rounded-lg border p-6 sm:p-8 transition-colors duration-300"
              style={{
                background: 'var(--lp-elevated)',
                borderColor: 'var(--lp-border)',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--lp-border-strong)';
                (e.currentTarget as HTMLElement).style.background = 'var(--lp-elevated-hover)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--lp-border)';
                (e.currentTarget as HTMLElement).style.background = 'var(--lp-elevated)';
              }}
            >
              {/* Brand symbol */}
              <div
                className="mb-6 font-mono font-black leading-none select-none"
                style={{ fontSize: 'clamp(2.5rem, 4vw, 3.5rem)', color: 'var(--lp-symbol)' }}
                aria-hidden="true"
              >
                {cell.symbol}
              </div>

              <h3
                className="mb-3 font-bold leading-snug"
                style={{ fontSize: 'clamp(1rem, 2vw, 1.25rem)', color: 'var(--lp-fg)' }}
              >
                {cell.title}
              </h3>

              <p className="text-sm leading-relaxed" style={{ color: 'var(--lp-muted)' }}>
                {cell.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export const CardsGridSection = EquipesSection;

