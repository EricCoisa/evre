'use client';

import Link from 'next/link';
import { Logo } from '@/components/logo';
import { defaulHometData } from '@/lib/actions/cms/home/type';

interface LandingFooterProps {
  footerText?: string;
}

export function LandingFooter({
  footerText = defaulHometData.footerText!,
}: LandingFooterProps) {
  return (
    <footer
      className="border-t"
      style={{ background: 'var(--lp-bg)', borderColor: 'var(--lp-border)', padding: '4rem max(2rem, env(safe-area-inset-left,0px))' }}
    >
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-start justify-between gap-10 md:flex-row md:items-center">
          {/* Logo */}
          <Link href="/" className="shrink-0 opacity-60 hover:opacity-90 transition-opacity" aria-label="EVRE Software House">
            <Logo className="h-6 w-24" />
          </Link>

          {/* Links */}
          <nav className="flex flex-wrap gap-6 text-xs" style={{ color: 'var(--lp-muted)' }} aria-label="Rodapé">
            {[
              { href: '#sites', label: 'Sites' },
              { href: '#sistemas', label: 'Sistemas' },
              { href: '#equipes', label: 'Equipes' },
              { href: '#contato', label: 'Contato' },
            ].map(({ href, label }) => (
              <a
                key={href}
                href={href}
                className="transition-colors duration-200"
                style={{ color: 'var(--lp-muted)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--lp-fg)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--lp-muted)')}
              >
                {label}
              </a>
            ))}
            <Link
              href="/legal/termo-uso"
              className="transition-colors duration-200"
              style={{ color: 'var(--lp-muted)' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--lp-fg)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--lp-muted)'}
            >
              Termos
            </Link>
            <Link
              href="/legal/privacy-policy"
              className="transition-colors duration-200"
              style={{ color: 'var(--lp-muted)' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--lp-fg)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--lp-muted)'}
            >
              Privacidade
            </Link>
          </nav>

          {/* Copyright */}
          <span className="text-xs" style={{ color: 'var(--lp-muted)' }}>
            © {new Date().getFullYear()} {footerText}
          </span>
        </div>
      </div>
    </footer>
  );
}
