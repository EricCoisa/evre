'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import { AsciiBackground } from './ascii-background';
import { LiquidDistortion } from './liquid-distortion';
import { defaulHometData } from '@/lib/actions/cms/home/type';
import { makeWhatsappUrl } from './utils';
import { BrandIconPlay, BrandIconSlash, BrandIconPlayInverse } from '@/components/brand-icons';

interface HeroSectionProps {
  title?: string;
  description?: string;
  cta?: string;
  whatsappNumber?: string;
}

export function HeroSection({
  title = defaulHometData.heroTitle!,
  description = defaulHometData.heroDescription!,
  cta = defaulHometData.heroCta!,
  whatsappNumber = defaulHometData.heroWhatsappNumber!,
}: HeroSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const whatsappUrl = makeWhatsappUrl(whatsappNumber);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      // Initial hidden states
      gsap.set('.hero-title', { clipPath: 'inset(100% -15% 0% -5%)' });
      gsap.set('.hero-desc', { clipPath: 'inset(100% 0 0 0)' });
      gsap.set('.hero-actions', { clipPath: 'inset(100% 0 0 0)' });
      gsap.set('.hero-brand-panel', { x: 80, opacity: 0 });
      gsap.set('.hero-brand-panel-mobile', { x: 30, opacity: 0 });
      gsap.set('.hero-bicon', { rotateY: -40, rotateX: 20, opacity: 0 });

      // Entrance timeline
      const tl = gsap.timeline({ delay: 0.15 });
      tl
        .to('.hero-title', { clipPath: 'inset(-15% -15% -15% -5%)', duration: 0.9, ease: 'expo.out' })
        .to('.hero-desc', { clipPath: 'inset(0% 0 0 0)', duration: 0.75, ease: 'expo.out' }, '-=0.55')
        .to('.hero-actions', { clipPath: 'inset(0% 0 0 0)', duration: 0.75, ease: 'expo.out' }, '-=0.5')
        .set(['.hero-title', '.hero-desc', '.hero-actions'], { clearProps: 'clipPath' })
        .to('.hero-brand-panel', { x: 0, opacity: 1, duration: 1.1, ease: 'expo.out' }, 0.3)
        .to('.hero-brand-panel-mobile', { x: 0, opacity: 1, duration: 1.1, ease: 'expo.out' }, 0.3)
        .to('.hero-bicon', { rotateY: 0, rotateX: 0, opacity: 1, duration: 0.9, ease: 'expo.out', stagger: 0.09 }, 0.4);

      // Scroll parallax only on desktop
      const mm = gsap.matchMedia();
      mm.add('(min-width: 768px)', () => {
        gsap.to('.hero-title', {
          y: -70,
          scrollTrigger: { trigger: sectionRef.current, start: 'top top', end: 'bottom top', scrub: 1.5 },
        });
        gsap.to('.hero-desc', {
          y: -30, opacity: 0,
          scrollTrigger: { trigger: sectionRef.current, start: 'center top', end: 'bottom top', scrub: 1 },
        });
        gsap.to('.hero-brand-panel', {
          y: -130, rotateX: -6,
          scrollTrigger: { trigger: sectionRef.current, start: 'top top', end: 'bottom top', scrub: 2 },
        });
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="hero"
      className="relative flex min-h-screen flex-col justify-center overflow-hidden px-4 pb-16 pt-28 sm:px-6 sm:pb-20 sm:pt-32 md:px-8 md:pt-36"
      style={{ background: 'var(--lp-bg)' }}
    >
      <AsciiBackground charDensity={55} />

      {/* Brand panel — hidden on mobile */}
      <div
        className="hero-brand-panel absolute right-0 top-1/2 hidden -translate-y-1/2 gap-5 lg:flex"
        style={{ perspective: '900px', color: 'var(--lp-fg)' }}
        aria-hidden="true"
      >
        {[BrandIconPlay, BrandIconSlash, BrandIconPlayInverse].map((Icon, i) => (
          <div
            key={i}
            className="hero-bicon"
            style={{
              width: 'clamp(90px, 10vw, 150px)',
              height: 'clamp(90px, 10vw, 150px)',
              transformStyle: 'preserve-3d',
              willChange: 'transform',
            }}
          >
            <Icon />
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto w-full max-w-6xl">
        <div className="relative mb-9 w-full">
          <LiquidDistortion className="block w-fit" strength={32} radius={110}>
            <h1
              className="hero-title font-black leading-none tracking-tight whitespace-pre-wrap"
              style={{
                fontSize: 'clamp(1.85rem, 8.2vw, 9.5rem)',
                letterSpacing: '-0.03em',
                color: 'var(--lp-fg)',
              }}
            >
              {title}
            </h1>
          </LiquidDistortion>

          {/* Mobile brand icons — positioned in the open area to the right of 'sob medida.' */}
          <div
            className="hero-brand-panel-mobile absolute right-0 bottom-1 flex gap-2 lg:hidden"
            style={{ perspective: '600px', color: 'var(--lp-fg)' }}
            aria-hidden="true"
          >
            {[BrandIconPlay, BrandIconSlash, BrandIconPlayInverse].map((Icon, i) => (
              <div
                key={i}
                className="hero-bicon"
                style={{
                  width: 'clamp(32px, 8.5vw, 48px)',
                  height: 'clamp(32px, 8.5vw, 48px)',
                  transformStyle: 'preserve-3d',
                  willChange: 'transform',
                }}
              >
                <Icon />
              </div>
            ))}
          </div>
        </div>

        <p
          className="hero-desc mb-10 max-w-sm text-base leading-relaxed md:text-lg"
          style={{ color: 'var(--lp-muted)' }}
        >
          {description}
        </p>

        <div className="hero-actions flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-sm px-6 py-3.5 text-sm font-bold tracking-wide transition-opacity hover:opacity-85 text-center"
            style={{ background: 'var(--lp-fg)', color: 'var(--lp-bg)' }}
          >
            {cta}
          </a>
          <a
            href="#sites"
            className="inline-flex items-center justify-center sm:justify-start gap-2 py-2 sm:py-0 text-sm transition-colors duration-200"
            style={{ color: 'var(--lp-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--lp-fg)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--lp-muted)')}
          >
            Ver o que fazemos <span>→</span>
          </a>
        </div>
      </div>

    </section>
  );
}
