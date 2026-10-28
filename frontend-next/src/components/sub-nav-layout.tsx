'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { useTabParam } from '@/hooks/use-tab-param';
import { useTranslation } from '@/hooks/use-translation';
import { flashHashTarget } from '@/lib/hash-target';
import { cn } from '@/lib/cn';
import { ChevronDown, Check } from 'lucide-react';

export interface SubNavItem {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  badge?: ReactNode;
  hidden?: boolean;
  idAttr?: string;
}

export interface SubNavSection {
  id?: string;
  idAttr?: string;
  title?: ReactNode;
  items: SubNavItem[];
}

export interface SubNavLayoutProps {
  sections: SubNavSection[];
  defaultTab: string;
  tab?: string;
  onTabChange?: (tab: string) => void;
  children: ReactNode;
  className?: string;
  sidebarClassName?: string;
  contentClassName?: string;
}

interface SubNavDesktopSidebarProps {
  sections: SubNavSection[];
  activeTab: string;
}

function SubNavDesktopSidebar({ sections, activeTab }: SubNavDesktopSidebarProps) {
  return (
    <aside className="hidden md:block w-44 lg:w-48 xl:w-56 shrink-0 border-r border-border/50 pr-3 lg:pr-4 xl:pr-5">
      <TabsPrimitive.List className="flex flex-col space-y-6 w-full bg-transparent p-0 border-0">
        {sections.map((section, sIdx) => {
          const visibleItems = section.items.filter((item) => !item.hidden);
          if (visibleItems.length === 0) return null;

          return (
            <div key={sIdx} className="space-y-1 w-full">
              {section.title && (
                <h4
                  id={section.idAttr ?? (section.id ? `section-${section.id}` : undefined)}
                  className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 select-none"
                >
                  {section.title}
                </h4>
              )}
              <div className="space-y-0.5 w-full">
                {visibleItems.map((item) => {
                  const isActive = activeTab === item.id;

                  return (
                    <TabsPrimitive.Trigger
                      key={item.id}
                      id={item.idAttr ?? item.id}
                      value={item.id}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg text-left transition-all outline-none cursor-pointer',
                        'focus-visible:ring-2 focus-visible:ring-primary/40',
                        isActive
                          ? 'bg-primary/10 text-primary font-semibold shadow-xs'
                          : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                      )}
                    >
                      {item.icon && (
                        <span className={cn('size-4 shrink-0 transition-colors', isActive ? 'text-primary' : 'text-muted-foreground')}>
                          {item.icon}
                        </span>
                      )}
                      <span className="truncate flex-1">{item.label}</span>
                      {item.badge && <span className="shrink-0">{item.badge}</span>}
                    </TabsPrimitive.Trigger>
                  );
                })}
              </div>
            </div>
          );
        })}
      </TabsPrimitive.List>
    </aside>
  );
}

function findActiveItem(sections: SubNavSection[], activeTab: string): SubNavItem | undefined {
  for (const section of sections) {
    const item = section.items.find((i) => i.id === activeTab && !i.hidden);
    if (item) return item;
  }
  return undefined;
}

interface SubNavMobileDrawerProps {
  sections: SubNavSection[];
  activeTab: string;
  onTabChange: (value: string) => void;
}

function SubNavMobileDrawer({ sections, activeTab, onTabChange }: SubNavMobileDrawerProps) {
  const { t } = useTranslation('common');
  const [open, setOpen] = useState(false);
  const activeItem = findActiveItem(sections, activeTab);

  return (
    <div className="block md:hidden w-full sticky top-0 z-20 py-1 mb-1.5 bg-background/95 backdrop-blur-md border-border/40">
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          <button
            id="sub-nav-mobile-trigger"
            type="button"
            className="w-full h-11 px-4 flex items-center justify-between rounded-xl border border-border/80 bg-card shadow-xs text-sm font-medium transition-all hover:bg-muted/50 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer"
            aria-label={t('navigate_sections')}
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
              {activeItem?.icon && (
                <span className="size-4 shrink-0 text-primary">
                  {activeItem.icon}
                </span>
              )}
              <span className="truncate font-semibold text-foreground">
                {activeItem?.label}
              </span>
            </div>
            <ChevronDown className="size-4 text-muted-foreground shrink-0 transition-transform duration-200" />
          </button>
        </DrawerTrigger>
        <DrawerContent className="max-h-[85vh] pb-8">
          <DrawerHeader className="border-b pb-3">
            <DrawerTitle className="text-base font-semibold">{t('navigate_sections')}</DrawerTitle>
            <DrawerDescription className="text-xs text-muted-foreground">{t('select_section')}</DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 py-3 space-y-5 pb-12">
            {sections.map((section, sIdx) => {
              const visibleItems = section.items.filter((item) => !item.hidden);
              if (visibleItems.length === 0) return null;

              return (
                <div key={sIdx} className="space-y-1.5">
                  {section.title && (
                    <h5 className="px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                      {section.title}
                    </h5>
                  )}
                  <div className="space-y-1">
                    {visibleItems.map((item) => {
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            onTabChange(item.id);
                            setOpen(false);
                          }}
                          className={cn(
                            'w-full min-h-[48px] flex items-center gap-3 px-3.5 py-3 text-sm font-medium rounded-xl text-left transition-colors cursor-pointer',
                            isActive
                              ? 'bg-primary/10 text-primary font-semibold'
                              : 'text-foreground hover:bg-muted/70 active:bg-muted'
                          )}
                        >
                          {item.icon && (
                            <span className={cn('size-4 shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')}>
                              {item.icon}
                            </span>
                          )}
                          <span className="truncate flex-1">{item.label}</span>
                          {item.badge && <span className="shrink-0">{item.badge}</span>}
                          {isActive && <Check className="size-4 text-primary shrink-0 ml-2" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

export function SubNavLayout({
  sections,
  defaultTab,
  tab: controlledTab,
  onTabChange: controlledOnTabChange,
  children,
  className,
  sidebarClassName,
  contentClassName,
}: SubNavLayoutProps) {
  const [internalTab, setInternalTab] = useTabParam(defaultTab);
  const tab = controlledTab ?? internalTab;
  const setTab = controlledOnTabChange ?? setInternalTab;

  // Cobre carregamento direto da página (link colado/refresh) e troca de aba vinda da busca —
  // o id já existe desde o skeleton (ConfigRowSkeleton), então não precisa esperar o dado carregar.
  // ponytail: trocar de resultado dentro da MESMA aba não dispara `hashchange` nem muda `tab` — não
  // reposiciona nesse caso específico. Resolver exigiria observar a URL inteira, não só o tab param.
  useEffect(() => {
    flashHashTarget();
    window.addEventListener('hashchange', flashHashTarget);
    return () => window.removeEventListener('hashchange', flashHashTarget);
  }, [tab]);

  return (
    <Tabs value={tab} onValueChange={setTab} className={cn('w-full min-w-0 max-w-full', className)}>
      <div className="flex flex-col md:flex-row gap-2 md:gap-4 lg:gap-6 items-start w-full">
        <SubNavMobileDrawer sections={sections} activeTab={tab} onTabChange={setTab} />
        <div className={sidebarClassName}>
          <SubNavDesktopSidebar sections={sections} activeTab={tab} />
        </div>
        <main className={cn('flex-1 min-w-0 w-full', contentClassName)}>
          {children}
        </main>
      </div>
    </Tabs>
  );
}

export { TabsContent };
