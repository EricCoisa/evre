import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

export function useTabParam(defaultTab: string) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTabInUrl = searchParams.get('tab');
  const [tab, setTabState] = useState(() => currentTabInUrl ?? defaultTab);
  const [prevParams, setPrevParams] = useState({ searchParamsStr: searchParams.toString(), defaultTab });

  // Sincroniza `tab` quando a URL muda por fora (navegação, back/forward) — ajuste de
  // estado durante o render (não em effect) evita o commit extra
  const currentParamsStr = searchParams.toString();
  if (prevParams.searchParamsStr !== currentParamsStr || prevParams.defaultTab !== defaultTab) {
    setPrevParams({ searchParamsStr: currentParamsStr, defaultTab });
    setTabState(currentTabInUrl ?? defaultTab);
  }

  function setTab(value: string) {
    setTabState(value);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', value);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return [tab, setTab] as const;
}
