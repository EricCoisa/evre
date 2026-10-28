'use client';

import { usePathname } from 'next/navigation';
import { BreadcrumbNav } from '@/components/breadcrumb-nav';
import { useMe } from '@/lib/actions/auth/queries';

export function ConditionalBreadcrumb() {
  const { data } = useMe();
  const routes = data?.routes || [];
  const pathname = usePathname();
  
  const homeRoute = routes.find(route => route.isHome);
  // Não exibe o breadcrumb na página home
  if (pathname === homeRoute?.path) {
    return null;
  }
  
  return (
    <div className="">
      <BreadcrumbNav />
    </div>
  );
}