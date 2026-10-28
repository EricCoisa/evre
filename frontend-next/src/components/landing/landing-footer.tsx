'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArrowUp } from 'lucide-react';
import { defaulHometData } from '@/lib/actions/cms/home/type';

interface LandingFooterProps {
  footerText?: string;
}

export function LandingFooter({
  footerText = defaulHometData.footerText || 'EVRE Software House',
}: LandingFooterProps) {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="border-t border-border bg-muted/30 py-12 text-muted-foreground dark:bg-[#060608]">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="flex flex-col items-center justify-between gap-8 md:flex-row">
          {/* Logo & Slogan */}
          <div className="flex flex-col items-center md:items-start">
            <div className="relative h-8 w-32">
              <Image
                src="/brand/evre/logo-black.svg"
                alt={footerText}
                fill
                className="object-contain object-left dark:hidden"
              />
              <Image
                src="/brand/evre/logo-white.svg"
                alt={footerText}
                fill
                className="hidden object-contain object-left dark:block"
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Desenvolvimento de software e plataformas sob medida.
            </p>
          </div>

          {/* Links */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-xs sm:gap-8">
            <a href="#servicos" className="transition-colors hover:text-foreground">
              Serviços
            </a>
            <a href="#processo" className="transition-colors hover:text-foreground">
              Processo
            </a>
            <a href="#contato" className="transition-colors hover:text-foreground">
              Contato
            </a>
            <Link
              href="/legal/termo-uso"
              className="transition-colors hover:text-foreground"
            >
              Termos de Uso
            </Link>
            <Link
              href="/legal/privacy-policy"
              className="transition-colors hover:text-foreground"
            >
              Privacidade
            </Link>
          </div>

          {/* Voltar ao Topo */}
          <button
            onClick={scrollToTop}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card/60 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Voltar ao topo"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-8 flex flex-col items-center justify-center border-t border-border/60 pt-6 text-xs text-muted-foreground/80 sm:flex-row sm:justify-between">
          <span>
            © {new Date().getFullYear()} {footerText}. Todos os direitos reservados.
          </span>
        </div>
      </div>
    </footer>
  );
}
