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
import { useHome, useRoute } from '@/lib/actions/access/route/queries';

// Helper function to get nested property value from object using dot notation
function getNestedProperty<T, K extends string>(obj: T, path: K): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (current && typeof current === 'object' && key in current) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

export function BreadcrumbNav() {
  const { data: user } = useMe();
  const pathname = usePathname();

  const segments = pathname
    .split('/')
    .filter((seg) => seg);

  console.log('BreadcrumbNav pathname segments:', segments);

  // Identificar se tem ID na URL (última posição é UUID)
  const hasId = segments.length > 0 && isUUID(segments[segments.length - 1]);
  const id = hasId ? segments[segments.length - 1] : undefined;

  // routePath é o nome da rota (penúltimo se tiver ID, último se não tiver)
  const routePath = hasId && segments.length > 1
    ? segments[segments.length - 2]
    : segments[0] || '';

  const { data: home, refetch: refetchHome } = useHome();
  const { data: currentRoute, refetch } = useRoute(routePath);

  useEffect(() => {
    refetch();
    refetchHome()
  }, [pathname, refetch]);

  // Buscar configuração de query para o nome do item
  const route = RoutePagesList.find(r => r.path === currentRoute?.path);
  console.log('currentRoute', currentRoute);
  console.log('routrouteePath', route);
  console.log('routePath', routePath);
  console.log('home', home);

  const nullcast: RoutePageQuery<string> = ({
    queryKey: () => ["null", "null"],
    queryFn: () => nullFunction(),
  });

  const queryConfig = route?.getBreadName() ?? nullcast;

  // Query para buscar o nome do item quando há ID
  const query = useQuery<string>({
    queryKey: queryConfig ? (queryConfig.queryKey(id) as readonly unknown[]) : [],
    queryFn: queryConfig
      ? (async () => await queryConfig.queryFn(id) as string)
      : undefined,
    enabled: !!queryConfig && !!id, // só executa se a rota existir e tiver ID
  });
  console.log('queryConfig', queryConfig);
  console.log('query', query.data);

  const { state } = useSidebar();
  const { t } = useTranslation('common');
  const { setItem, items } = useBread();

  console.log('BreadcrumbNav items', items);
  useEffect(() => {
    if (hasId && id && route) {
      const name = query.data && route.key
        ? getNestedProperty(query.data, route.key)
        : null;
      console.log('Fetched name for breadcrumb:', query.data, name);
      if (name && name !== items) {
        setItem(String(name));
      }
    } else {
      if (items !== null) setItem(null);
    }
  }, [hasId, id, route, query.data, items, setItem]);

  if (pathname === '/(private)/redirect' || pathname === '/redirect') {
    return null;
  }

  // Se a rota atual é Home, mas tem ID na URL, renderizar Home > NomeDoItem (ou id)
  if (currentRoute?.isHome) {
    return (
      <Breadcrumb className={`transition-all duration-200 ${state === 'collapsed' ? 'ml-0' : 'ml-0'}`}>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={home?.path || "/home"} prefetch={true}>
                {t(currentRoute.labelKey || 'home')}
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          {hasId && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>
                  {items || id}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  // Se a rota atual tem parent, renderizar Home > parent > rota atual (ou nome do item), mas evitar duplicidade se parent for o próprio home
  if (currentRoute?.parent) {
    const isParentHome = home && (currentRoute.parent.id === home.id || currentRoute.parent.path === home.path);
    return (
      <Breadcrumb className={`transition-all duration-200 ${state === 'collapsed' ? 'ml-0' : 'ml-0'}`}>
        <BreadcrumbList>
          {/* Home */}
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={home?.path || "/home"} prefetch={true}>
                {t(home?.labelKey || 'home')}
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          {/* Só renderiza o parent se não for o próprio home */}
          {!isParentHome && <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={currentRoute.parent.path || "#"} prefetch={true}>
                  {t(currentRoute.parent.labelKey || currentRoute.parent.path)}
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
          </>}
          <BreadcrumbSeparator />
          {/* Rota atual ou nome do item */}
          <BreadcrumbItem>
            {hasId ? (
              <BreadcrumbPage>{items || id}</BreadcrumbPage>
            ) : (
              <BreadcrumbPage>{t(currentRoute.labelKey || routePath)}</BreadcrumbPage>
            )}
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  // Para rotas que não são home
  const currentRouteLabel = currentRoute?.labelKey ? t(currentRoute.labelKey) : routePath;

  return (
    <Breadcrumb className={`transition-all duration-200 ${state === 'collapsed' ? 'ml-0' : 'ml-0'}`}>
      <BreadcrumbList>
        {/* Sempre renderizar Home primeiro (quando não estamos na home) */}
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href={home?.path || "/home"} prefetch={true}>
              {t(home?.labelKey || 'home')}
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>

        {/* Renderizar a rota atual */}
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          {hasId ? (
            // Se tem ID, a rota atual é um link
            <BreadcrumbLink asChild>
              <Link href={`/${routePath}`} prefetch={true}>
                {currentRouteLabel}
              </Link>
            </BreadcrumbLink>
          ) : (
            // Se não tem ID, a rota atual é a página final
            <BreadcrumbPage>{currentRouteLabel}</BreadcrumbPage>
          )}
        </BreadcrumbItem>

        {/* Se tem ID, renderizar o nome do item */}
        {hasId && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>
                {items || id}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
