'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar
} from '@/components/ui/sidebar';
import LangLabel from './ui/langLabel';
import { cn } from '@/lib/utils';
import { getIcon } from '@/lib/utils';

interface NavItem {
  title: string;
  url: string;
  iconName: string; // Changed from icon to iconName
}

interface SidebarNavProps {
  navItems: NavItem[];
}

export function SidebarNav({ navItems }: SidebarNavProps) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();

  const handleClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <SidebarMenu className="space-y-1">
      {navItems.map((item, index) => {
        const isActive = pathname === item.url;
        const IconComponent = getIcon(item.iconName); // Resolve icon on client side

        return (
          <SidebarMenuItem key={item.title} className="overflow-visible">

            <>
              <SidebarMenuButton asChild className="z-10 rounded-l-xl group-data-[collapsible=icon]:rounded-r-xl w-full overflow-visible">
                <Link
                  id={`tour-nav-${index}`}
                  href={item.url}
                  prefetch={true}
                  onClick={handleClick}
                  className={cn(
                    "flex h-max items-center gap-3 py-3 rounded-none transition-all duration-200 group relative border",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground border-sidebar-accent/30"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground border-transparent"
                  )}
                >
                  <IconComponent
                    className={cn(
                      "h-4 w-4 transition-colors duration-200",
                      isActive
                        ? "text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/70 group-hover:text-sidebar-accent-foreground"
                    )}
                  />
                  <span className={cn(
                    "group-data-[collapsible=icon]:hidden text-sm font-medium transition-colors duration-200",
                    isActive
                      ? "text-sidebar-accent-foreground font-semibold"
                      : "text-sidebar-foreground group-hover:text-sidebar-accent-foreground"
                  )}>
                    <LangLabel text={item.title} />
                  </span>

                </Link>
              </SidebarMenuButton>
            </>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}