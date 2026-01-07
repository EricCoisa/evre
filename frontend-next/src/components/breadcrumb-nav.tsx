'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { useSidebar } from '@/components/ui/sidebar';
import { useTranslation } from '@/hooks/use-translation';
import { useBread } from '@/contexts/bread-context';
import { isUUID } from '@/lib/utils';
import { nullFunction, RoutePageQuery, RoutePagesList } from '@/lib/types/routepages.types';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useMe } from '@/lib/actions/auth/queries';

export function BreadcrumbNav() {
  const { data: user } = useMe();

  const routes = user?.routes || [];
  const pathname = usePathname();
  let segments = pathname
    .split('/')
    .filter((seg) => seg && seg !== 'private');
  const home = routes.find(route => route.isHome);
  const isHome = home ? (`/${segments[0]}` === home.path) : false;

  const idUser = segments[segments.length - 1];
  const penultimate = segments.length > 1 ? segments[segments.length - 2] : null;

  const route = RoutePagesList.find(r => r.path === penultimate);
  const nullcast: RoutePageQuery<string> = ({
    queryKey: () => ["null", "null"],
    queryFn: () => nullFunction(),
  })

  const queryConfig = route?.getBreadName() ?? nullcast

  // Agora sim: chamamos a query aqui, de forma segura
  const query = useQuery<string>({
    queryKey: queryConfig ? (queryConfig.queryKey(idUser) as readonly unknown[]) : [],
    queryFn: queryConfig
    ? (async () => await queryConfig.queryFn(idUser) as string)
      : undefined,
    enabled: !!queryConfig, // só executa se a rota existir
  });

  const { state } = useSidebar();
  const { t } = useTranslation('common');
  const { setItem, items } = useBread();

  // Não atualiza contexto durante o render
  segments = segments.map((segment) => segment);

  // Atualiza o contexto de breadcrumb fora do render
  useEffect(() => {
    if (isUUID(idUser) && penultimate != null && !isUUID(penultimate)) {
      const name = route && query.data && query.data[route?.key as keyof typeof query.data] ? String(query.data[route?.key as keyof typeof query.data]) : null;
      if (name && name !== items) {
        setItem(name);
      }
    } else {
      if (items !== null) setItem(null);
    }
  }, [idUser, penultimate, route, query.data, items, setItem]);

  if (pathname === '/(private)/redirect' || pathname === '/redirect') {
    return null;
  }

  return (
    <Breadcrumb className={`transition-all duration-200 ${state === 'collapsed' ? 'ml-0' : 'ml-0'}`}>
      <BreadcrumbList>
      {!isHome && (
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href={home?.path || "/home"} prefetch={true}>
              {t(home?.labelKey || 'home')}
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>)}

        {segments.map((segment, index) => {
          const isLast = index === segments.length - 1;
          const href = '/' + segments.slice(0, index + 1).join('/');

          // Busca da rota o labelKey igual ao page-title
          const labelKey = routes.find(route => route.path === href)?.labelKey;
          const label = t(labelKey || segment);
          if(isHome) return null; // já renderizamos o home lá em cima
       
          return (
            <React.Fragment key={segment}>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {isLast ?
                (
                  <BreadcrumbPage>{items ? items : label}</BreadcrumbPage>
                ) :
                (
                  <BreadcrumbLink asChild>
                    <Link href={href} prefetch={true}>
                      {label}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
