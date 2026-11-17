'use client';

import { useState, useEffect, useMemo, type RefObject } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/logo';
import { BrandIconsBlink } from '@/components/brand-icons-blink';
import { Menu, X, ArrowUpRight, MessageCircle } from 'lucide-react';
import { defaulHometData } from '@/lib/actions/cms/home/type';
import { makeWhatsappUrl } from './utils';
import { cn } from '@/lib/cn';

export interface NavItem {
  href: string;
  label: string;
  mobileLabel?: string;
}

export interface LandingNavProps {
  whatsappNumber?: string;
  navItems?: NavItem[];
  navLogoRef?: RefObject<HTMLAnchorElement | null>;
  navBrandIconsRef?: RefObject<HTMLAnchorElement | null>;
}

const defaultNavItems: NavItem[] = defaulHometData.sections!.map(section => ({
  href: `#${section.anchorId}`,
  label: section.navLabel || section.label.split('&')[0].trim(),
  mobileLabel: section.label,
}));

export function LandingNav({
  whatsappNumber = defaulHometData.heroWhatsappNumber!,
  navItems,
  navLogoRef,
  navBrandIconsRef,
}: LandingNavProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const whatsappUrl = makeWhatsappUrl(whatsappNumber);

  const items = navItems && navItems.length > 0 ? navItems : defaultNavItems;

  const mobileItems = useMemo(() => {
    const list = [...items];
    if (!list.some(i => i.href === '#contato')) {
      list.push({ href: '#contato', label: 'Contato', mobileLabel: 'Contato' });
    }
    return list;
  }, [items]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 45);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex justify-center px-4 pt-4 sm:pt-6">
      {/* Top subtle backdrop fade on mobile so scrolling text doesn't show in the top gap */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-background via-background/60 to-transparent md:hidden"
        aria-hidden="true"
      />
      <nav
        className="relative w-full max-w-5xl rounded-2xl border border-border bg-background/80 px-5 py-3 backdrop-blur-xl transition-all duration-500 dark:border-white/10 dark:bg-black/80"
        style={{ boxShadow: scrolled ? '0 8px 40px rgba(0,0,0,0.18)' : '0 2px 12px rgba(0,0,0,0.06)' }}
      >
        <div className="flex items-center justify-between">
          {/* Desktop Logo — sempre visível, sem interferência de GSAP ou transforms */}
          <Link
            href="/"
            className="hidden items-center transition-opacity hover:opacity-90 md:flex"
            aria-label="EVRE Software House"
          >
            <Logo priority className="w-28 sm:w-32" />
          </Link>

          {/* Mobile Logo / Brand Icons Container */}
          <div className="relative flex items-center md:hidden">
            {/* Logo Mobile — sincronizada via GSAP com a hero */}
            <Link
              ref={navLogoRef}
              href="/"
              className={cn(
                'nav-logo-mobile flex items-center hover:opacity-90',
                // ponytail: !important overrides GSAP inline styles enquanto o menu mobile está aberto
                mobileOpen && '!opacity-100 ![transform:none]'
              )}
              aria-label="EVRE Software House"
            >
              <Logo priority className="w-28" />
            </Link>

            {/* Brand icons Mobile — exibido quando a logo na nav estiver oculta */}
            <Link
              ref={navBrandIconsRef}
              href="/"
              className={cn(
                'nav-brand-icons absolute left-0 flex items-center transition-opacity hover:opacity-90 text-foreground',
                mobileOpen && '!opacity-0 !pointer-events-none'
              )}
              aria-label="EVRE"
            >
              <BrandIconsBlink size={20} duration={1.8} minOpacity={0.35} maxOpacity={1} />
            </Link>
          </div>

          {/* Desktop links */}
          <nav className="hidden items-center gap-8 md:flex" aria-label="Navegação principal">
            {items.map(({ href, label }) => (
              <a key={href} href={href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                {label}
              </a>
            ))}
          </nav>

          {/* Desktop CTA */}
          <div className="hidden items-center gap-3 md:flex">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-foreground px-4 py-2 text-xs font-semibold text-background transition-opacity hover:opacity-90"
            >
              <MessageCircle className="h-3.5 w-3.5 text-emerald-500" />
              <span>Falar com a equipe</span>
              <ArrowUpRight className="h-3.5 w-3.5 opacity-60" />
            </a>
            <Link
              href="/login"
              className="rounded-xl border border-border px-3.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
            >
              Portal
            </Link>
          </div>

          {/* Mobile burger */}
          <button
            onClick={() => setMobileOpen(v => !v)}
            className="rounded-lg p-2 text-muted-foreground hover:text-foreground md:hidden"
            aria-label="Menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 md:hidden">
            {mobileItems.map(({ href, label, mobileLabel }) => (
              <a key={href} href={href} className="py-1 text-sm text-muted-foreground hover:text-foreground" onClick={() => setMobileOpen(false)}>
                {mobileLabel || label}
              </a>
            ))}
            <div className="flex flex-col gap-2 pt-2">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl bg-foreground py-2.5 text-xs font-semibold text-background"
                onClick={() => setMobileOpen(false)}
              >
                <MessageCircle className="h-4 w-4 text-emerald-500" />
                <span>Falar com a equipe</span>
              </a>
              <Link
                href="/login"
                className="flex items-center justify-center rounded-xl border border-border py-2.5 text-xs text-muted-foreground"
                onClick={() => setMobileOpen(false)}
              >
                Portal do Cliente
              </Link>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
