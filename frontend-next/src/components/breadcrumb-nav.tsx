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
import { nullFunction, RoutePage, RoutePageQuery, RoutePagesList } from '@/lib/types/routepages.types';
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

  interface BreadHelp {
    path: string;
    labelKey?: string;
    routePageQuery?: RoutePage<unknown>;
    name?: string;
  }

  // Constrói o array de breadcrumbs baseado nos segmentos da URL
  const initialBreadSegments = React.useMemo(() => {
    if (!user?.routes) return [];
    return segments.map((seg, i) => {
      const routeMatch = user.routes.find((route) => route.path === "/" + seg);
      const hasId = isUUID(seg);
      let queryConfig: RoutePage<unknown> | undefined = undefined;
      if (hasId && i > 0) {
        const lastSeg = segments[i - 1];
        queryConfig = RoutePagesList.find((r) => r.path === "/" + lastSeg);
      }
      return {
        path: queryConfig ? seg : routeMatch?.path,
        labelKey: routeMatch?.labelKey,
        routePageQuery: queryConfig,
        name: undefined
      } as BreadHelp;
    });
  }, [pathname, user]);

  const [breadSegments, setBreadSegments] = React.useState<BreadHelp[]>([]);

  // Sincroniza breadSegments quando pathname ou user mudam
  React.useEffect(() => {
    setBreadSegments(initialBreadSegments);
  }, [pathname, user?.routes]);

  const lastNoQuery = breadSegments.findLast((l) => !l.routePageQuery);
  const currentRoute = user?.routes.find((route) => route.path === lastNoQuery?.path);
  // routePath é o nome da rota (penúltimo se tiver ID, último se não tiver)

  const { data: home, refetch: refetchHome } = useHome();
  // const { data: currentRoute, refetch } = useRoute(routePath);

  useEffect(() => {
    // refetch();
    refetchHome()
  }, [pathname]);

  // Buscar configuração de query para o nome do item


  const nullcast: RoutePageQuery<string> = ({
    queryKey: () => ["null", "null"],
    queryFn: () => nullFunction(),
  });

  const segmentWithId = breadSegments.find(x => x.routePageQuery);
  const queryConfig = segmentWithId?.routePageQuery?.getBreadName() ?? nullcast;
  // Query para buscar o nome do item quando há ID
  const query = useQuery<string>({
    queryKey: queryConfig ? (queryConfig.queryKey(segmentWithId?.path) as readonly unknown[]) : [],
    queryFn: queryConfig
      ? (async () => await queryConfig.queryFn(segmentWithId?.path) as string)
      : undefined,
    enabled: !!queryConfig && !!segmentWithId?.path, // só executa se a rota existir e tiver ID
  });
  const { state } = useSidebar();
  const { t } = useTranslation('common');
  const { setItem, items } = useBread();

  // Atualiza o campo name quando query.data estiver disponível
  React.useEffect(() => {
    if (segmentWithId && segmentWithId.path && segmentWithId.routePageQuery && query.data) {
      const name = segmentWithId.routePageQuery.key
        ? getNestedProperty(query.data, segmentWithId.routePageQuery.key)
        : null;

      if (name) {
        // Só atualiza se o name for diferente
        setBreadSegments((prev) => {
          const needsUpdate = prev.some(seg =>
            seg.routePageQuery && seg.name !== String(name)
          );

          if (needsUpdate) {
            return prev.map(seg =>
              seg.routePageQuery
                ? { ...seg, name: String(name) }
                : seg
            );
          }
          return prev;
        });

        if (String(name) !== items) {
          setItem(String(name));
        }
      }
    } else {
      if (items !== null) setItem(null);
    }
  }, [query.data, segmentWithId?.path, items, setItem, pathname]);

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
          {segmentWithId && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>
                  {items || segmentWithId.path}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  return (
    <Breadcrumb className={`transition-all duration-200 ${state === 'collapsed' ? 'ml-0' : 'ml-0'}`}>
      <BreadcrumbList>

        {breadSegments.map((seg, index) => {
          const isLast = index === breadSegments.length - 1;
          const label = seg.name || t(seg?.labelKey || 'home');
          let content;
          if (isLast) {
            content = <BreadcrumbPage>{label}</BreadcrumbPage>;
          } else {
            // Se for name, monta o href dinâmico, senão usa path padrão
            const href = seg.name
              ? `${breadSegments[index - 1]?.path}/${seg.path}`
              : seg?.path || "/home";
            content = (
              <BreadcrumbLink asChild>
                <Link href={href} prefetch={true}>
                  {label}
                </Link>
              </BreadcrumbLink>
            );
          }
          return (
            <React.Fragment key={index}>
              <BreadcrumbItem>{content}</BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </React.Fragment>
          );
        })}

      </BreadcrumbList>
    </Breadcrumb>
  );
}
