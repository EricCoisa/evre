"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { AsyncBoundary } from "@/components/async-boundary";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";

interface ConfigRowProps {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** Controle ocupa a linha inteira, abaixo do título, em vez da coluna estreita. */
  wide?: boolean;
  /** Âncora de DOM para deep-link (ex.: busca de recursos no header). */
  id?: string;
}

const rowLayout = (wide?: boolean) =>
  cn("flex flex-col gap-3 py-4", !wide && "sm:flex-row sm:items-center sm:justify-between sm:gap-4");

/* Consistent column width — controls align; mobile stacks full-width */
const controlLayout = (wide?: boolean) => cn("w-full shrink-0", !wide && "sm:w-48 md:w-64");

/** Mesmo grid da linha real, para o conteúdo não pular quando o dado chega. */
function ConfigRowSkeleton({ wide, id }: { wide?: boolean; id?: string }) {
  return (
    <div id={id} className={rowLayout(wide)}>
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-40 max-w-full" />
        <Skeleton className="h-3 w-64 max-w-full" />
      </div>
      <div className={controlLayout(wide)}>
        <Skeleton className="h-9 w-full" />
      </div>
    </div>
  );
}

/** Linha de configuração com título, descrição e controle carregando juntos via AsyncBoundary. */
export function ConfigRow({ title, description, children, wide, id }: ConfigRowProps) {
  return (
    <AsyncBoundary
      fallback={<ConfigRowSkeleton wide={wide} id={id} />}
      errorFallback={(retry) => (
        <div id={id} className={rowLayout(wide)}>
          <div className="min-w-0 flex-1">
            <p className="font-medium">{title}</p>
          </div>
          <div className={controlLayout(wide)}>
            <ErrorState compact onRetry={retry} />
          </div>
        </div>
      )}
    >
      <div id={id} className={rowLayout(wide)}>
        <div className="min-w-0 flex-1">
          <p className="font-medium">{title}</p>
          {description && (
            <p className="text-muted-foreground text-sm">{description}</p>
          )}
        </div>
        <div className={controlLayout(wide)}>{children}</div>
      </div>
    </AsyncBoundary>
  );
}

interface ConfigListProps {
  children: ReactNode;
}

export function ConfigList({ children }: ConfigListProps) {
  return <div className="flex flex-col divide-y">{children}</div>;
}
