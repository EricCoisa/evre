'use client';

import * as React from 'react';
import { useEffect, useMemo } from 'react';
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
import { RoutePagesList } from '@/lib/types/routepages.types';
import { useQueries } from '@tanstack/react-query';
import { useMe } from '@/lib/actions/auth/queries';
import { breadcrumbTrail } from '@/lib/route-tree';

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
  const { state } = useSidebar();
  const { t } = useTranslation('common');
  const { setItem, items } = useBread();

  const crumbs = useMemo(
    () => breadcrumbTrail(user?.routes ?? [], pathname),
    [user?.routes, pathname],
  );

  const dynamic = useMemo(
    () =>
      crumbs.flatMap((crumb) => {
        const page = crumb.dynamicOf
          ? RoutePagesList.find((r) => r.path === crumb.dynamicOf)
          : undefined;
        return page ? [{ crumb, page }] : [];
      }),
    [crumbs],
  );

  const results = useQueries({
    queries: dynamic.map(({ crumb, page }) => {
      const query = page.getBreadName(crumb.raw);
      return {
        queryKey: query.queryKey(crumb.raw) as readonly unknown[],
        queryFn: () => query.queryFn(crumb.raw),
      };
    }),
  });

  const resolved = dynamic.map(({ crumb, page }, i) => {
    const data = results[i]?.data;
    const raw = data && page.key ? getNestedProperty(data, page.key) : data;
    return { href: crumb.href, name: raw ? String(raw) : undefined };
  });
  const nameByHref = new Map(resolved.map((r) => [r.href, r.name]));

  // O último nome resolvido é o que o PageTitle exibe.
  const lastName = resolved.filter((r) => r.name).at(-1)?.name ?? null;
  useEffect(() => {
    if (lastName !== items) setItem(lastName);
  }, [lastName, items, setItem]);

  if (pathname === '/(private)/redirect' || pathname === '/redirect') return null;

  return (
    <Breadcrumb className={`transition-all duration-200 ${state === 'collapsed' ? 'ml-0' : 'ml-0'}`}>
      <BreadcrumbList>
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          // Sem rota cadastrada e sem query configurada, o próprio segmento é o rótulo.
          const label =
            nameByHref.get(crumb.href) ??
            (crumb.labelKey
              ? t(crumb.labelKey)
              : nameByHref.has(crumb.href)
                ? t('loading')
                : crumb.raw);

          return (
            <React.Fragment key={crumb.href}>
              <BreadcrumbItem className={isLast ? 'inline-flex max-w-[150px] sm:max-w-none truncate' : 'hidden sm:inline-flex'}>
                {isLast ? (
                  <BreadcrumbPage className="truncate">{label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={crumb.href} prefetch={true}>
                      {label}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator className="hidden sm:inline-flex" />}
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
