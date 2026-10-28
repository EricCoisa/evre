'use client';

import { Skeleton } from '@/components/ui/skeleton';

/** Esqueleto de carregamento que imita o chrome do Payload (navegação, cabeçalho e lista). */
export function CmsSkeleton() {
  return (
    <div className="absolute inset-0 flex bg-background" aria-busy="true">
      <div className="hidden w-60 shrink-0 flex-col gap-4 border-r p-4 sm:flex">
        <Skeleton className="h-6 w-32" />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-4 w-full" />
          ))}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-4 p-6">
        <Skeleton className="h-7 w-48 max-w-full" />
        <Skeleton className="h-4 w-72 max-w-full" />
        <div className="space-y-3 pt-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
