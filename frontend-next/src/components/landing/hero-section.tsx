'use client';

import Image from 'next/image';
import { AsciiBackground } from './ascii-background';
import { MessageCircle, ArrowRight } from 'lucide-react';
import { defaulHometData } from '@/lib/actions/cms/home/type';

interface HeroSectionProps {
  title?: string;
  description?: string;
  primaryButtonText?: string;
  secondaryButtonText?: string;
  whatsappNumber?: string;
}

export function HeroSection({
  title = defaulHometData.heroTitle!,
  description = defaulHometData.heroDescription!,
  primaryButtonText = defaulHometData.heroPrimaryButtonText!,
  secondaryButtonText = defaulHometData.heroSecondaryButtonText!,
  whatsappNumber = defaulHometData.heroWhatsappNumber!,
}: HeroSectionProps) {
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=Ol%C3%A1!%20Gostaria%20de%20conversar%20sobre%20um%20projeto%20com%20a%20EVRE.`;

  return (
    <section className="relative flex min-h-[85vh] flex-col items-center justify-center overflow-hidden bg-background px-4 pt-32 pb-16 sm:px-6 sm:pt-36 sm:pb-24">
      {/* ASCII Canvas Background */}
      <AsciiBackground charDensity={32} />

      {/* Glow suave */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2"
      >
        <div className="h-[320px] w-[600px] rounded-full bg-foreground/[0.03] blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center text-center">
        {/* Headline */}
        <h1 className="mb-6 text-3xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl leading-[1.15]">
          {title}
        </h1>

        {/* Subtítulo */}
        <p className="mb-10 max-w-2xl text-base text-muted-foreground sm:text-lg leading-relaxed">
          {description}
        </p>

        {/* Ações */}
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2.5 rounded-xl bg-foreground px-6 py-3.5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
          >
            <MessageCircle className="h-4 w-4 text-emerald-500" />
            <span>{primaryButtonText}</span>
            <ArrowRight className="h-4 w-4 opacity-60" />
          </a>

          <a
            href="#servicos"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-6 py-3.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <span>{secondaryButtonText}</span>
            <span className="text-muted-foreground">↓</span>
          </a>
        </div>

        {/* Card Visual com a Assinatura da Marca EVRE */}
        <div className="mt-16 w-full max-w-2xl rounded-2xl border border-border bg-card/70 p-6 shadow-xl backdrop-blur-md dark:border-white/10 dark:bg-[#0C0C10]">
          <div className="grid grid-cols-3 gap-4">
            {/* Planejamento */}
            <div className="flex flex-col items-center justify-center rounded-xl border border-border/50 bg-background/50 p-4 text-center dark:border-white/5 dark:bg-white/[0.02]">
              <div className="relative mb-2 h-9 w-9">
                <Image
                  src="/brand/evre/icon-chevron-left-black.svg"
                  alt="Planejamento"
                  fill
                  className="object-contain dark:hidden"
                />
                <Image
                  src="/brand/evre/icon-chevron-left.svg"
                  alt="Planejamento"
                  fill
                  className="hidden object-contain dark:block"
                />
              </div>
              <span className="text-xs font-semibold text-foreground">Planejamento</span>
              <span className="mt-0.5 text-[11px] text-muted-foreground">Arquitetura &amp; Escopo</span>
            </div>

            {/* Desenvolvimento */}
            <div className="flex flex-col items-center justify-center rounded-xl border border-border/50 bg-background/50 p-4 text-center dark:border-white/5 dark:bg-white/[0.02]">
              <div className="relative mb-2 h-9 w-9">
                <Image
                  src="/brand/evre/icon-slash-black.svg"
                  alt="Desenvolvimento"
                  fill
                  className="object-contain dark:hidden"
                />
                <Image
                  src="/brand/evre/icon-slash.svg"
                  alt="Desenvolvimento"
                  fill
                  className="hidden object-contain dark:block"
                />
              </div>
              <span className="text-xs font-semibold text-foreground">Desenvolvimento</span>
              <span className="mt-0.5 text-[11px] text-muted-foreground">Engenharia &amp; Testes</span>
            </div>

            {/* Entrega */}
            <div className="flex flex-col items-center justify-center rounded-xl border border-border/50 bg-background/50 p-4 text-center dark:border-white/5 dark:bg-white/[0.02]">
              <div className="relative mb-2 h-9 w-9">
                <Image
                  src="/brand/evre/icon-chevron-right-black.svg"
                  alt="Entrega"
                  fill
                  className="object-contain dark:hidden"
                />
                <Image
                  src="/brand/evre/icon-chevron-right.svg"
                  alt="Entrega"
                  fill
                  className="hidden object-contain dark:block"
                />
              </div>
              <span className="text-xs font-semibold text-foreground">Entrega</span>
              <span className="mt-0.5 text-[11px] text-muted-foreground">Produção &amp; Suporte</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
