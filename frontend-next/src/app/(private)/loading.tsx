import { Skeleton } from '@/components/ui/skeleton';

/** Esqueleto de carregamento genérico para a navegação entre rotas da área privada. */
export default function PrivateLoading() {
  return (
    <div className="p-4 sm:p-6 space-y-6" aria-busy="true" aria-live="polite">
      <div className="flex flex-wrap gap-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-9 w-32" />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
