import { LandingNav } from '@/components/landing/landing-nav';
import { LandingFooter } from '@/components/landing/landing-footer';

const legalNavItems = [{ href: '/', label: 'Início' }];

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ background: 'var(--lp-bg)', color: 'var(--lp-fg)' }}
    >
      <LandingNav navItems={legalNavItems} />
      <main className="flex-1 pt-28">{children}</main>
      <LandingFooter />
    </div>
  );
}
