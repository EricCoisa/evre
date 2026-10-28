'use client';

import { LayoutGrid, Layers, Database, Smartphone, LucideIcon } from 'lucide-react';
import { HomeService, defaulHometData } from '@/lib/actions/cms/home/type';

const ICON_MAP: Record<string, LucideIcon> = {
  'layout-grid': LayoutGrid,
  layers: Layers,
  database: Database,
  smartphone: Smartphone,
};

interface SolutionsBentoProps {
  title?: string;
  description?: string;
  services?: HomeService[];
}

export function SolutionsBento({
  title = defaulHometData.servicesTitle || 'O que desenvolvemos',
  description = defaulHometData.servicesDescription || 'Soluções digitais sob medida para resolver necessidades reais da sua operação.',
  services = defaulHometData.services || [],
}: SolutionsBentoProps) {
  return (
    <section id="servicos" className="relative bg-background py-20 sm:py-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="mb-14 text-center">
          <h2 className="mb-4 text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl">
            {title}
          </h2>
          <p className="mx-auto max-w-xl text-sm text-muted-foreground sm:text-base">
            {description}
          </p>
        </div>

        {/* Grid de 3 Serviços */}
        <div className="grid gap-5 md:grid-cols-3">
          {services.map((service, index) => {
            const Icon = ICON_MAP[service.iconName] || Layers;
            return (
              <div
                key={service.id || index}
                className="flex flex-col justify-between rounded-2xl border border-border bg-card/60 p-7 transition-colors hover:border-foreground/20 dark:border-white/10 dark:bg-[#0C0C10] dark:hover:border-white/20"
              >
                <div>
                  <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-muted/60 text-foreground dark:border-white/10 dark:bg-white/[0.03]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mb-2.5 text-lg font-semibold text-foreground">
                    {service.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {service.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
