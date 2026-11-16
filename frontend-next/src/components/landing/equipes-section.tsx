'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import { defaulHometData } from '@/lib/actions/cms/home/type';
import { LiquidDistortion } from './liquid-distortion';

export interface EquipesSectionProps {
  anchorId?: string;
  label?: string;
  title?: string;
  description?: string;
  cards?: Array<{ title: string; description: string }>;
}

const defaultCards = [
  { title: 'Integração com\nseu processo', description: 'A EVRE entra no seu fluxo de trabalho existente. Sprints, revisões e entregas contínuas sem mudar como sua equipe funciona.' },
  { title: 'Foco no que\nvocê precisa', description: 'Você define a prioridade, a EVRE executa. Sem overhead de gestão nem curva de aprendizado prolongado.' },
  { title: 'Resultado\nverificável', description: 'Comece com um projeto de escopo definido. Avalie a qualidade do trabalho antes de qualquer comprometimento maior.' },
];

export function EquipesSection({
  anchorId = 'equipes',
  label = 'Parceria em desenvolvimento',
  title = 'Ferramentas que\na equipe\nrealmente usa.',
  description = 'Cada equipe tem um jeito de trabalhar. Construímos o software que encaixa nesse jeito, não o contrário.',
  cards = defaultCards,
}: EquipesSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
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
        scrollTrigger: { trigger: '.equipes-grid', start: 'top 80%', end: 'top 20%', scrub: 2 },
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const symbols = ['>', '/', '<'];
  const cells = cards.map((card, i) => ({ symbol: symbols[i % symbols.length], ...card }));

  return (
    <section
      ref={sectionRef}
      id={anchorId}
      className="relative overflow-hidden"
      style={{ background: 'var(--lp-bg)', padding: 'clamp(4rem, 10vw, 10rem) max(2rem, env(safe-area-inset-left,0px))' }}
    >
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-20 max-w-2xl">
          <div
            className="equipes-label mb-7 flex items-center gap-3 text-xs font-medium uppercase tracking-widest"
            style={{ color: 'var(--lp-muted)' }}
          >
            <span className="font-mono font-black select-none flex-shrink-0" aria-hidden="true">{'>'}</span>
            {label}
          </div>

          <LiquidDistortion className="mb-6 block w-fit">
            <h2
              className="equipes-title font-black leading-none tracking-tight whitespace-pre-wrap"
              style={{ fontSize: 'clamp(2rem, 5vw, 4.25rem)', letterSpacing: '-0.025em', color: 'var(--lp-fg)' }}
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
              className="equipes-card group relative overflow-hidden rounded-lg border p-8 transition-colors duration-300"
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

