'use client';

import { createElement, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar
} from '@/components/ui/sidebar';
import LangLabel from './ui/langLabel';
import { cn } from '@/lib/cn';
import { getIcon } from '@/lib/utils';
import type { RouteNode } from '@/lib/route-tree';

interface SidebarNavProps {
  navItems?: RouteNode[];
}

export function SidebarNav({ navItems = [] }: SidebarNavProps) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();

  const handleClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <SidebarMenu className="space-y-1">
      {navItems.map((item, index) => (
        <NavRow
          key={item.id}
          item={item}
          index={index}
          depth={0}
          pathname={pathname}
          onNavigate={handleClick}
        />
      ))}
    </SidebarMenu>
  );
}

const ROOT_LINK = 'h-max py-3 border rounded-l-xl group-data-[collapsible=icon]:rounded-r-xl group-data-[collapsible=icon]:px-3';
const ROOT_LINK_ACTIVE =
  'bg-sidebar-accent text-sidebar-accent-foreground border-sidebar-accent/30';
const ROOT_LINK_IDLE =
  'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground border-transparent';
const CHILD_LINK = 'h-9 px-3 w-full border rounded-l-lg group-data-[collapsible=icon]:rounded-r-lg group-data-[collapsible=icon]:px-2';
const CHILD_LINK_ACTIVE =
  'bg-sidebar-accent/50 text-sidebar-accent-foreground border-sidebar-accent/20';
const CHILD_LINK_IDLE =
  'text-sidebar-foreground/80 hover:bg-sidebar-accent/30 hover:text-sidebar-foreground border-transparent';

function NavIcon({ name, isActive }: { name: string | null; isActive: boolean }) {
  return createElement(getIcon(name), {
    className: cn(
      'h-5 w-5 transition-colors duration-200',
      isActive
        ? 'text-sidebar-accent-foreground'
        : 'text-sidebar-foreground/70 group-hover:text-sidebar-accent-foreground'
    ),
  });
}

interface NavLinkProps {
  item: RouteNode;
  id?: string;
  isRoot: boolean;
  isActive: boolean;
  onNavigate: () => void;
}

function getNavLinkClasses(isRoot: boolean, isActive: boolean): string {
  if (isRoot) {
    return cn('pl-3', ROOT_LINK, isActive ? ROOT_LINK_ACTIVE : ROOT_LINK_IDLE);
  }
  return cn('px-3', CHILD_LINK, isActive ? CHILD_LINK_ACTIVE : CHILD_LINK_IDLE);
}

function getNavLabelClasses(isRoot: boolean, isActive: boolean): string {
  const sizeClass = isRoot ? 'font-medium' : 'text-sm';
  const colorClass = isActive
    ? 'text-sidebar-accent-foreground font-semibold'
    : 'text-sidebar-foreground group-hover:text-sidebar-accent-foreground';
  return cn('group-data-[collapsible=icon]:hidden transition-colors duration-200', sizeClass, colorClass);
}

function NavLink({ item, id, isRoot, isActive, onNavigate, hasChildren, open, onToggle }: NavLinkProps & { hasChildren?: boolean; open?: boolean; onToggle?: () => void }) {
  return (
    <Link
      id={id}
      href={item.path}
      prefetch={true}
      onClick={onNavigate}
      className={cn(
        'flex items-center gap-3 transition-all duration-200 group relative w-full',
        getNavLinkClasses(isRoot, isActive),
      )}
    >
      <NavIcon name={item.icon} isActive={isActive} />
      <span className={getNavLabelClasses(isRoot, isActive)}>
        <LangLabel text={item.labelKey} />
      </span>
      {hasChildren && open !== undefined && onToggle && (
        <button
          type="button"
          aria-label={open ? 'collapse' : 'expand'}
          aria-expanded={open}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(); }}
          className="ml-auto rounded-md p-1 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:hidden"
        >
          <ChevronRight className={cn('h-4 w-4 transition-transform duration-200', open && 'rotate-90')} />
        </button>
      )}
    </Link>
  );
}



/** Entrar na subárvore reabre o grupo; o toggle continua mandando enquanto se fica nela. */
function useSubtreeOpen(isUnder: boolean) {
  const [open, setOpen] = useState(isUnder);
  const [wasUnder, setWasUnder] = useState(isUnder);
  if (isUnder !== wasUnder) {
    setWasUnder(isUnder);
    if (isUnder) setOpen(true);
  }
  return [open, setOpen] as const;
}

interface NavRowProps {
  item: RouteNode;
  index: number;
  depth: number;
  pathname: string;
  onNavigate: () => void;
}

function NavRow({ item, index, depth, pathname, onNavigate }: NavRowProps) {
  const isActive = pathname === item.path;
  const isUnder = isActive || pathname.startsWith(`${item.path}/`);
  const hasChildren = item.children.length > 0;
  const isRoot = depth === 0;

  const [open, setOpen] = useSubtreeOpen(isUnder);

  const Item = isRoot ? SidebarMenuItem : SidebarMenuSubItem;
  const Button = isRoot ? SidebarMenuButton : SidebarMenuSubButton;

  return (
    <Item className="overflow-visible">
      <Button
        asChild
        isActive={isActive}
        className={cn(
          'z-10 w-full overflow-visible',
          isRoot && 'rounded-l-xl group-data-[collapsible=icon]:rounded-r-xl',
          !isRoot && 'rounded-l-lg group-data-[collapsible=icon]:rounded-r-lg',
          hasChildren && 'pr-8'
        )}
      >
        <NavLink
          item={item}
          id={isRoot ? `tour-nav-${index}` : undefined}
          isRoot={isRoot}
          isActive={isActive}
          onNavigate={onNavigate}
          hasChildren={hasChildren}
          open={open}
          onToggle={() => setOpen(!open)}
        />
      </Button>

      {hasChildren && (
        <div
          className={cn(
            'grid overflow-hidden transition-all duration-300 ease-in-out',
            open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
          )}
        >
          <div className="min-h-0">
            <SidebarMenuSub className="mx-0">
              {item.children.map((child, childIndex) => (
                <NavRow
                  key={child.id}
                  item={child}
                  index={childIndex}
                  depth={depth + 1}
                  pathname={pathname}
                  onNavigate={onNavigate}
                />
              ))}
            </SidebarMenuSub>
          </div>
        </div>
      )}
    </Item>
  );
}
