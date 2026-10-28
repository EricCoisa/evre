'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, X, ArrowUpRight, MessageCircle } from 'lucide-react';
import { defaulHometData } from '@/lib/actions/cms/home/type';

interface LandingNavProps {
  whatsappNumber?: string;
}

export function LandingNav({
  whatsappNumber = defaulHometData.heroWhatsappNumber || '5534953301409',
}: LandingNavProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=Ol%C3%A1!%20Gostaria%20de%20conversar%20sobre%20um%20projeto%20com%20a%20EVRE.`;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex justify-center px-4 pt-4 sm:pt-6">
      <nav className="w-full max-w-5xl rounded-2xl border border-border bg-background/80 px-5 py-3 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-[#0B0B0E]/85">
        <div className="flex items-center justify-between">
          {/* Logo EVRE (Light & Dark) */}
          <Link
            href="/"
            className="flex items-center transition-opacity hover:opacity-90"
            aria-label="EVRE Software House"
          >
            <div className="relative h-8 w-28 sm:h-8 sm:w-32">
              <Image
                src="/brand/evre/logo-black.svg"
                alt="EVRE"
                fill
                priority
                className="object-contain object-left dark:hidden"
              />
              <Image
                src="/brand/evre/logo-white.svg"
                alt="EVRE"
                fill
                priority
                className="hidden object-contain object-left dark:block"
              />
            </div>
          </Link>

          {/* Links Desktop */}
          <div className="hidden items-center gap-8 md:flex">
            <a
              href="#servicos"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Serviços
            </a>
            <a
              href="#processo"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Processo
            </a>
            <a
              href="#contato"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Contato
            </a>
          </div>

          {/* Ações */}
          <div className="hidden items-center gap-3 md:flex">
            {/* WhatsApp CTA */}
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-foreground px-4 py-2 text-xs font-semibold text-background transition-opacity hover:opacity-90"
            >
              <MessageCircle className="h-3.5 w-3.5 text-emerald-500" />
              <span>WhatsApp</span>
              <ArrowUpRight className="h-3.5 w-3.5 opacity-60" />
            </a>

            {/* Link Portal */}
            <Link
              href="/login"
              className="rounded-xl border border-border px-3.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
            >
              Portal
            </Link>
          </div>

          {/* Botão Mobile */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded-lg p-2 text-muted-foreground hover:text-foreground md:hidden"
            aria-label="Menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Menu Mobile */}
        {mobileMenuOpen && (
          <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 md:hidden">
            <a
              href="#servicos"
              onClick={() => setMobileMenuOpen(false)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Serviços
            </a>
            <a
              href="#processo"
              onClick={() => setMobileMenuOpen(false)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Processo
            </a>
            <a
              href="#contato"
              onClick={() => setMobileMenuOpen(false)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Contato
            </a>
            <div className="flex flex-col gap-2 pt-2">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl bg-foreground py-2.5 text-xs font-semibold text-background"
              >
                <MessageCircle className="h-4 w-4 text-emerald-500" />
                <span>Conversar no WhatsApp</span>
              </a>
              <Link
                href="/login"
                className="flex items-center justify-center rounded-xl border border-border py-2.5 text-xs text-muted-foreground"
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
