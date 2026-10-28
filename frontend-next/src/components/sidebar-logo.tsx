'use client';

import Link from 'next/link';
import { APP_VERSION } from '@/lib/version';
import { SITE_NAME, siteInitials } from '@/lib/site';
import { SidebarMenuButton } from '@/components/ui/sidebar';
import { cn } from '@/lib/cn';

interface SidebarLogoProps {
  homeUrl?: string;
}

export function SidebarLogo({ homeUrl = '/' }: SidebarLogoProps) {
  return (
    <SidebarMenuButton
      size="lg"
      asChild
      className="w-full hover:bg-unset group-data-[collapsible=icon]:!w-full group-data-[collapsible=icon]:!p-0"
    >
      <Link 
        href={homeUrl} 
        prefetch={true} 
        className={cn(
          "flex items-center gap-3 p-2 rounded-lg transition-all duration-200",
          "group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:justify-center",
        )}
      >
        <div className={cn(
          "flex shrink-0 bg-primary aspect-square size-10 items-center justify-center rounded-xl text-white transition-all duration-200",
          "group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:rounded-lg",
        )}>
          <span className="text-sm font-bold text-secondary">{siteInitials()}</span>
        </div>
        <div className="hover:text-primary  grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
          <span className={cn(
            "truncate font-semibold transition-colors duration-200"
          )}>
            {SITE_NAME}
          </span>
          <span className="truncate text-xs text-sidebar-foreground/70">
            v{APP_VERSION}
          </span>
        </div>
      </Link>
    </SidebarMenuButton>
  );
}