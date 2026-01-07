'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { APP_VERSION } from '@/lib/version';
import { SidebarMenuButton } from '@/components/ui/sidebar';
import LangLabel from './ui/langLabel';
import { cn } from '@/lib/utils';

interface SidebarLogoProps {
  homeUrl: string;
}

export function SidebarLogo({ homeUrl }: SidebarLogoProps) {
  return (
    <SidebarMenuButton size="lg" asChild className="w-full hover:bg-unset">
      <Link 
        href={homeUrl} 
        prefetch={true} 
        className={cn(
          "flex items-center gap-3 p-2 rounded-lg transition-all duration-200",
        )}
      >
        <div className={cn(
          "flex bg-primary aspect-square size-10 items-center justify-center group-data-[collapsible=icon]:pl-2 group-data-[collapsible=icon]:justify-start rounded-xl text-white transition-all duration-200",
        )}>
          <span className="text-sm font-bold text-secondary"><LangLabel text={'brandInitials'} /></span>
        </div>
        <div className="hover:text-primary  grid flex-1 text-left text-sm leading-tight">
          <span className={cn(
            "truncate font-semibold transition-colors duration-200"
          )}>
            <LangLabel text={'brand'} />
          </span>
          <span className="truncate text-xs text-sidebar-foreground/70">
            v{APP_VERSION}
          </span>
        </div>
      </Link>
    </SidebarMenuButton>
  );
}