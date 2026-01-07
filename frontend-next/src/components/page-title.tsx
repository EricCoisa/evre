'use client';

import { usePathname } from 'next/navigation';
import { useTranslation } from '@/hooks/use-translation';
import { useBread } from '@/contexts/bread-context';
import { useMe } from '@/lib/actions/auth/queries';

export function PageTitle() {
  const { data: user  } = useMe();
  const routes = user?.routes || [];

  const { items } = useBread();
  const pathname = usePathname();
  const { t } = useTranslation('common');
  const segments = pathname
    .split('/')
    .filter((seg) => seg && seg !== 'private');

  // Pega o último segmento ou 'home' como padrão
  const lastSegment = segments[segments.length - 1] || 'home';

  const name = routes.find(route => route.path === `/${lastSegment}`)?.labelKey; //busca da rota o labelKey
  const title = items ?? t(name || lastSegment);

  return (
    <div className="mb-2">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
    </div>
  );
}
