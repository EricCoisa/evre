'use client';

import { SidebarTrigger } from './ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { UserMenu } from './user-menu';
import { ThemeToggle } from './theme-toggle';
import { Switch } from './ui/switch';
import { useApp } from '@/contexts/appProvider';
import { BreadcrumbNav } from './breadcrumb-nav';
import { isDevelopment } from '@/lib/utils';

export function Header() {
  const { devTools, setDevTools } = useApp();

  return (
    <header className="flex h-(--header-height) items-end shrink-0 gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height) bg-gradient-to-b from-sidebar via-sidebar/95 to-sidebar/90">
      <div
        className="flex w-full h-full lg:rounded-tl-2xl items-center gap-1 px-4 lg:gap-2 lg:px-6 bg-background lg:h-[calc(var(--header-height)-10px)]"
      >
        {/* Left section: Sidebar trigger */}
        <div className="flex items-center gap-3">
          <SidebarTrigger className="-ml-1 rounded-md p-2 transition-all duration-200 hover:bg-accent text-accent-foreground" />
          <Separator orientation="vertical" className="h-6 bg-border" />
          <BreadcrumbNav />
        </div>

        {/* Right section: User menu and controls */}
        <div className="flex items-center gap-2 ml-auto">
          <ThemeToggle />
          <UserMenu />
          {isDevelopment() && (
            <div className="dev rounded-md px-3 py-2 flex items-center bg-warning-100 dark:bg-warning-900/30 border border-warning-300 dark:border-warning-700">
              <Switch aria-label='DevTools' checked={devTools} onCheckedChange={() => setDevTools(!devTools)} />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
