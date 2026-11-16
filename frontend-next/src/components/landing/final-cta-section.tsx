'use client';

import { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import { defaulHometData } from '@/lib/actions/cms/home/type';

interface FinalCtaSectionProps {
  title?: string;
  buttonText?: string;
  whatsappNumber?: string;
  contactEmail?: string;
}

export function FinalCtaSection({
  title = defaulHometData.ctaTitle!,
  buttonText = defaulHometData.ctaButtonText!,
  whatsappNumber = defaulHometData.heroWhatsappNumber!,
  contactEmail = defaulHometData.contactEmail!,
}: FinalCtaSectionProps) {
  const [copied, setCopied] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=Ol%C3%A1!%20Gostaria%20de%20conversar%20sobre%20um%20projeto%20com%20a%20EVRE.`;

  const copyEmail = () => {
    navigator.clipboard.writeText(contactEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      gsap.set('.cta-title', { clipPath: 'inset(100% 0 0 0)' });
      gsap.set('.cta-actions', { opacity: 0, y: 20 });

      gsap.to('.cta-title', {
        clipPath: 'inset(0% 0 0 0)',
        scrollTrigger: { trigger: sectionRef.current, start: 'top 75%', end: 'top 20%', scrub: 1.5 },
      });
      gsap.to('.cta-actions', {
        opacity: 1, y: 0,
        scrollTrigger: { trigger: '.cta-actions', start: 'top 85%', end: 'top 55%', scrub: 1 },
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="contato"
      className="relative overflow-hidden"
      style={{ background: 'var(--lp-bg)', padding: '10rem max(2rem, env(safe-area-inset-left,0px)) 8rem' }}
    >
      {/* Divider line */}
      <div className="mx-auto mb-20 max-w-6xl" style={{ height: '1px', background: 'var(--lp-border)' }} />

      <div className="mx-auto max-w-6xl">
        <h2
          className="cta-title mb-16 font-black leading-none tracking-tight whitespace-pre-wrap"
          style={{
            fontSize: 'clamp(3rem, 10vw, 11rem)',
            letterSpacing: '-0.03em',
            color: 'var(--lp-fg)',
          }}
        >
          {title}
        </h2>

        <div className="cta-actions flex flex-wrap items-center gap-5">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 rounded-sm px-8 py-4 text-sm font-bold tracking-wide transition-opacity hover:opacity-85"
            style={{ background: 'var(--lp-fg)', color: 'var(--lp-bg)' }}
          >
            {buttonText}
          </a>

          <button
            onClick={copyEmail}
            className="inline-flex items-center gap-2 text-sm transition-colors duration-200"
            style={{ color: copied ? 'var(--lp-fg)' : 'var(--lp-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--lp-fg)')}
            onMouseLeave={e => { if (!copied) e.currentTarget.style.color = 'var(--lp-muted)'; }}
          >
            {copied ? '✓ copiado' : contactEmail}
          </button>
        </div>
      </div>
    </section>
  );
}
