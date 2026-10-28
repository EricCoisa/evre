'use client';

import { Container } from './container';
import { Skeleton } from './ui/skeleton';

/** Fallback padrão do AsyncBoundary: esqueleto de painel de configuração dentro de um Container. */
export function PanelSkeleton() {
  return (
    <Container variant="form" padding>
      <div className="space-y-6" aria-busy="true">
        <div className="space-y-2">
          <Skeleton className="h-4 w-40 max-w-full" />
          <Skeleton className="h-3 w-72 max-w-full" />
        </div>
        <div className="flex flex-wrap gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-9 w-28" />
          ))}
        </div>
      </div>
    </Container>
  );
}
