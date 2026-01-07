import { getServerAccessToken } from '@/lib/actions/auth/server-auth';

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { UserRoute } from '@/lib/actions/auth/types';
import { getCurrentUser } from '@/lib/actions/auth/api';
import LangLabel from './ui/langLabel';
import { SidebarNav } from './sidebar-nav';
import { SidebarLogo } from './sidebar-logo';

export async function AppSidebar() {

  const accessToken = await getServerAccessToken();
  let routes: UserRoute[] | null = null;

  if (accessToken) {
    try {
      const user = (await getCurrentUser()).data;
      routes = user.routes || [];
    } catch {
      routes = [];
    }
  }
  if (routes === null) {
    routes = [];
  }

  const navItems = routes
    .sort((a, b) => a.ordem - b.ordem)
    .map((route) => ({
      title: route.labelKey,
      url: route.path,
      iconName: route.icon || 'default-icon', // Pass icon name as string instead of component
    }));

  const homeRoute = routes.find(route => route.isHome);
  return (
    <Sidebar collapsible="icon" className="border-none">
      <SidebarHeader className=" p-4 group-data-[collapsible=icon]:pl-2 bg-primary-50 dark:bg-primary-950/50">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarLogo homeUrl={homeRoute?.path || "/home"} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="py-4">
        <SidebarGroup className='p-0 pl-4 group-data-[collapsible=icon]:pl-2'>
          <SidebarGroupLabel className="text-xs font-medium text-primary-600 dark:text-primary-400 uppercase tracking-wider mb-3 bg-primary-100 dark:bg-primary-900/30 px-3 py-1 rounded-md">
            <LangLabel text={'navigation'} />
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarNav navItems={navItems} />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* <SidebarFooter className="group-data-[collapsible=icon]:opacity-0 border-t border-primary-200 dark:border-primary-800 p-4 bg-muted/50">
        <div className="text-xs text-muted-foreground text-center bg-primary-50 dark:bg-primary-950/30 px-2 py-1 rounded-sm">
          © 2025 EVRE Template
        </div>
      </SidebarFooter> */}


    </Sidebar>
  );
}
