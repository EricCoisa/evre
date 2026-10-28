'use client';

import Image from 'next/image';
import { HomeProcessStep, defaulHometData } from '@/lib/actions/cms/home/type';

const SYMBOL_ICON_MAP_DARK: Record<string, string> = {
  '<': '/brand/evre/icon-chevron-left.svg',
  '/': '/brand/evre/icon-slash.svg',
  '>': '/brand/evre/icon-chevron-right.svg',
};

const SYMBOL_ICON_MAP_LIGHT: Record<string, string> = {
  '<': '/brand/evre/icon-chevron-left-black.svg',
  '/': '/brand/evre/icon-slash-black.svg',
  '>': '/brand/evre/icon-chevron-right-black.svg',
};

interface ProcessTriadSectionProps {
  title?: string;
  description?: string;
  steps?: HomeProcessStep[];
}

export function ProcessTriadSection({
  title = defaulHometData.processTitle || 'Como trabalhamos',
  description = defaulHometData.processDescription || 'Processo direto e transparente para garantir previsibilidade em cada etapa.',
  steps = defaulHometData.processSteps || [],
}: ProcessTriadSectionProps) {
  return (
    <section id="processo" className="relative bg-muted/30 py-20 sm:py-28 dark:bg-[#09090C]">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="mb-14 text-center">
          <h2 className="mb-4 text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl">
            {title}
          </h2>
          <p className="mx-auto max-w-xl text-sm text-muted-foreground sm:text-base">
            {description}
          </p>
        </div>

        {/* 3 Etapas */}
        <div className="grid gap-6 md:grid-cols-3">
          {steps.map((step, index) => {
            const iconDark = SYMBOL_ICON_MAP_DARK[step.symbol] || '/brand/evre/icon-slash.svg';
            const iconLight = SYMBOL_ICON_MAP_LIGHT[step.symbol] || '/brand/evre/icon-slash-black.svg';

            return (
              <div
                key={step.id || index}
                className="rounded-2xl border border-border bg-card/70 p-6 transition-colors hover:border-foreground/20 dark:border-white/10 dark:bg-[#0C0C10] dark:hover:border-white/20"
              >
                <div className="mb-5 flex items-center justify-between">
                  <div className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-muted/50 dark:border-white/10 dark:bg-white/[0.03]">
                    <Image
                      src={iconLight}
                      alt={step.title}
                      fill
                      className="p-2.5 object-contain dark:hidden"
                    />
                    <Image
                      src={iconDark}
                      alt={step.title}
                      fill
                      className="hidden p-2.5 object-contain dark:block"
                    />
                  </div>
                  <span className="font-mono text-sm font-semibold text-muted-foreground">
                    {step.stepNumber}
                  </span>
                </div>

                <h3 className="mb-2 text-base font-semibold text-foreground">
                  {step.title}
                </h3>

                <p className="text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
