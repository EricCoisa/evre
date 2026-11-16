'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, X, ArrowUpRight, MessageCircle } from 'lucide-react';
import { defaulHometData } from '@/lib/actions/cms/home/type';

export interface NavItem {
  href: string;
  label: string;
  mobileLabel?: string;
}

export interface LandingNavProps {
  whatsappNumber?: string;
  navItems?: NavItem[];
}

const defaultNavItems: NavItem[] = defaulHometData.sections!.map(section => ({
  href: `#${section.anchorId}`,
  label: section.navLabel || section.label.split('&')[0].trim(),
  mobileLabel: section.label,
}));

export function LandingNav({
  whatsappNumber = defaulHometData.heroWhatsappNumber!,
  navItems,
}: LandingNavProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=Ol%C3%A1!%20Gostaria%20de%20conversar%20sobre%20um%20projeto%20com%20a%20EVRE.`;

  const items = navItems && navItems.length > 0 ? navItems : defaultNavItems;

  const mobileItems: NavItem[] = [...items];
  if (!mobileItems.some(i => i.href === '#contato')) {
    mobileItems.push({ href: '#contato', label: 'Contato', mobileLabel: 'Contato' });
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex justify-center px-4 pt-4 sm:pt-6">
      <nav
        className="w-full max-w-5xl rounded-2xl border border-border bg-background/80 px-5 py-3 backdrop-blur-xl transition-all duration-500 dark:border-white/10 dark:bg-black/80"
        style={{ boxShadow: scrolled ? '0 8px 40px rgba(0,0,0,0.18)' : '0 2px 12px rgba(0,0,0,0.06)' }}
      >
        <div className="flex items-center justify-between">
          {/* Logo — black em light, white em dark */}
          <Link href="/" className="flex items-center transition-opacity hover:opacity-90" aria-label="EVRE Software House">
            <div className="relative h-8 w-28 sm:w-32">
              <Image src="/brand/evre/logo-black.svg" alt="EVRE" fill priority className="object-contain object-left dark:hidden" />
              <Image src="/brand/evre/logo-white.svg" alt="EVRE" fill priority className="hidden object-contain object-left dark:block" />
            </div>
          </Link>

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
