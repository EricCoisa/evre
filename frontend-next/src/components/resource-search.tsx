'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation as useI18n } from 'react-i18next';
import { Search, Settings, type LucideIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { useTranslation } from '@/hooks/use-translation';
import { useMe } from '@/lib/actions/auth/queries';
import { useCapabilities } from '@/lib/actions/capability/queries';
import { useMyFeatureFlags } from '@/lib/actions/feature-flag/queries';
import { CAPABILITY_FIX_PATH } from '@/types/capabilities';
import { ConfigRowsList } from '@/lib/types/configrows.types';
import { TabsList } from '@/lib/types/tabs.types';
import { ButtonsList } from '@/lib/types/buttons.types';
import { flashHashTarget } from '@/lib/hash-target';
import { getIcon } from '@/lib/utils';
import { cn } from '@/lib/cn';

const MAX_RESULTS = 8;

/** `label` sempre contém `query` (já filtrado) — só precisa achar onde, pra negritar. */
function highlightMatch(label: string, query: string) {
  if (!query) return label;
  const idx = label.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return label;
  return (
    <>
      {label.slice(0, idx)}
      <mark className="bg-transparent text-foreground font-semibold">
        {label.slice(idx, idx + query.length)}
      </mark>
      {label.slice(idx + query.length)}
    </>
  );
}

interface SearchResult {
  key: string;
  label: string;
  path: string;
  hash?: string;
  Icon: LucideIcon;
}

export function ResourceSearch() {
  const { data: user } = useMe();
  const { data: capabilities } = useCapabilities();
  const { data: flags } = useMyFeatureFlags();
  const { t } = useTranslation('common');
  const { t: tSettings } = useI18n('settings');
  const { t: tProfile } = useI18n('profile');
  const { t: tAccess } = useI18n('access');
  const { t: tUsers } = useI18n('users');
  const { t: tMessaging } = useI18n('messaging');
  const router = useRouter();
  const [query, setQuery] = useState('');

  const allResults = useMemo<SearchResult[]>(() => {
    const routes = user?.routes ?? [];
    const accessiblePaths = new Set(routes.map((r) => r.path));

    const routeResults: SearchResult[] = routes.map((route) => ({
      key: `route:${route.id}`,
      label: t(route.labelKey),
      path: route.path,
      Icon: getIcon(route.icon),
    }));

    // Só aparece enquanto a capability está indisponível. Uma vez configurada, o resultado some;
    // o que sobra pra achar a tela é o config row correspondente (quando cadastrado) ou a rota em
    // si. `key` (ex.: 'CAPTCHA') é ALL_CAPS — mesmo bundle `labelKey` da rota, via `t`.
    const capabilityResults: SearchResult[] = Object.entries(capabilities ?? {}).flatMap(
      ([key, status]) => {
        if (status.operational !== false || status.available === false) return [];
        const path = CAPABILITY_FIX_PATH[key];
        if (!path) return [];
        const [pathname] = path.split('?');
        if (!accessiblePaths.has(pathname)) return [];
        const route = routes.find((r) => r.path === pathname);
        const label = route ? `${t(route.labelKey)} — ${t(key)}` : t(key);
        return [{ key: `capability:${key}`, label, path, Icon: Settings }];
      },
    );

    const tByNs: Record<string, (key: string) => string> = {
      settings: tSettings,
      profile: tProfile,
      access: tAccess,
      users: tUsers,
      messaging: tMessaging,
    };

    const tabResults: SearchResult[] = TabsList.filter(
      (entry) => accessiblePaths.has(entry.path) && (!entry.flag || flags?.[entry.flag]),
    ).map((entry) => {
      const route = routes.find((r) => r.path === entry.path);
      const label = route
        ? `${t(route.labelKey)} — ${tByNs[entry.labelNs](entry.labelKey)}`
        : tByNs[entry.labelNs](entry.labelKey);
      return { key: `tab:${entry.path}:${entry.tab}`, label, path: `${entry.path}?tab=${entry.tab}`, Icon: Settings };
    });

    // `entry.id` é o próprio labelKey (ex.: SYSTEM_CAPTCHA_ENABLED) — mesmo bundle `labelKey`.
    const configRowResults: SearchResult[] = ConfigRowsList.filter((entry) =>
      accessiblePaths.has(entry.path),
    ).map((entry) => ({
      key: `config:${entry.id}`,
      label: t(entry.id),
      path: `${entry.path}?tab=${entry.tab}`,
      hash: entry.id,
      Icon: Settings,
    }));

    const buttonResults: SearchResult[] = ButtonsList.filter((entry) => {
      const [basePath] = entry.path.split('?');
      return accessiblePaths.has(basePath) && (!entry.flag || flags?.[entry.flag]);
    }).map((entry) => {
      const route = routes.find((r) => r.path === entry.path);
      const actionLabel = tByNs[entry.labelNs]?.(entry.labelKey) ?? t(entry.labelKey);
      const label = route ? `${t(route.labelKey)} — ${actionLabel}` : actionLabel;
      const path = entry.tab ? `${entry.path}?tab=${entry.tab}` : entry.path;
      return {
        key: `button:${entry.id}`,
        label,
        path,
        hash: entry.id,
        Icon: getIcon(entry.icon ?? 'Plus'),
      };
    });

    return [...routeResults, ...capabilityResults, ...tabResults, ...configRowResults, ...buttonResults];
  }, [user?.routes, capabilities, flags, t, tSettings, tProfile, tAccess, tUsers, tMessaging]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return allResults
      .filter((r) => r.label.toLowerCase().includes(q))
      .sort((a, b) => a.label.localeCompare(b.label))
      .slice(0, MAX_RESULTS);
  }, [allResults, query]);

  const navigate = (result: SearchResult) => {
    router.push(result.hash ? `${result.path}#${result.hash}` : result.path);
    setQuery('');
    if (result.hash) {
      setTimeout(() => flashHashTarget(), 50);
    }
  };

  return (
    <>
      <div className="hidden sm:block w-full">
        <ResourceSearchDesktop
          query={query}
          setQuery={setQuery}
          results={results}
          navigate={navigate}
          placeholder={t('search')}
        />
      </div>
      <div className="sm:hidden">
        <ResourceSearchMobile
          query={query}
          setQuery={setQuery}
          results={results}
          navigate={navigate}
          placeholder={t('search')}
        />
      </div>
    </>
  );
}

function ResourceSearchDesktop({
  query,
  setQuery,
  results,
  navigate,
  placeholder,
}: {
  query: string;
  setQuery: (q: string) => void;
  results: SearchResult[];
  navigate: (r: SearchResult) => void;
  placeholder: string;
}) {
  const open = results.length > 0;

  return (
    <Popover open={open}>
      <PopoverAnchor asChild>
        <div className="relative w-full">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && results[0]) navigate(results[0]);
              if (e.key === 'Escape') setQuery('');
            }}
            placeholder={placeholder}
            className="h-9 pl-8"
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-anchor-width) p-1"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {results.map((result) => (
          <button
            key={result.key}
            type="button"
            onMouseDown={() => navigate(result)}
            className={cn(
              'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-left',
              'hover:bg-accent hover:text-accent-foreground',
            )}
          >
            <result.Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{highlightMatch(result.label, query)}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function ResourceSearchMobile({
  query,
  setQuery,
  results,
  navigate,
  placeholder,
}: {
  query: string;
  setQuery: (q: string) => void;
  results: SearchResult[];
  navigate: (r: SearchResult) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);

  const handleSelect = (r: SearchResult) => {
    navigate(r);
    setOpen(false);
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="size-8 rounded-md"
        aria-label={placeholder}
        onClick={() => setOpen(true)}
      >
        <Search className="size-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-[20%] translate-y-0 p-3 sm:max-w-md">
          <DialogHeader className="sr-only">
            <DialogTitle>{placeholder}</DialogTitle>
          </DialogHeader>
          <div className="relative w-full">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && results[0]) handleSelect(results[0]);
                if (e.key === 'Escape') setOpen(false);
              }}
              placeholder={placeholder}
              className="h-10 pl-8 text-base"
              autoFocus
            />
          </div>
          {results.length > 0 && (
            <div className="mt-2 space-y-1 max-h-60 overflow-y-auto">
              {results.map((result) => (
                <button
                  key={result.key}
                  type="button"
                  onClick={() => handleSelect(result)}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-left hover:bg-accent cursor-pointer"
                >
                  <result.Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{highlightMatch(result.label, query)}</span>
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
