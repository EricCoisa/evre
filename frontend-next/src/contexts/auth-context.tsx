'use client';

import React, { useLayoutEffect, useState } from 'react';
import { useUserConfiguration } from '@/lib/actions/userConfiguration/queries';
import { USER_CONFIG_KEYS } from '@/types/user-config-keys';

import { useTheme } from 'next-themes';
import { useMe } from '@/lib/actions/auth/queries';
import { setLang } from '@/lib/utils';
import { FullPageLoader } from '@/components/ui/full-page-loader';

/** Aplica idioma e tema do usuário antes de montar o shell, bloqueando o primeiro paint até lá. */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setTheme } = useTheme();
  const [applied, setApplied] = useState(false);

  useMe();
  const { data: userLanguage } = useUserConfiguration<string>(USER_CONFIG_KEYS.language);
  const { data: themeConfig } = useUserConfiguration<string>(USER_CONFIG_KEYS.theme);

  useLayoutEffect(() => {
    setLang(userLanguage?.value || 'pt-BR');
    if (themeConfig?.value) setTheme(themeConfig.value);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setApplied(true);
  }, [userLanguage?.value, themeConfig?.value, setTheme]);

  if (!applied) return <FullPageLoader />;

  return <>{children}</>;
}
