'use client';

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useUserConfiguration } from '@/lib/actions/userConfiguration/queries';

import { useTheme } from 'next-themes';
import i18n from '../../i18n'; // ajuste o path conforme o local do arquivo
import { useMe } from '@/lib/actions/auth/queries';
import { setLang } from '@/lib/utils';

export interface AuthContextData {
  // routes: UserRoute[];
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextData | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { theme, setTheme } = useTheme();

  const [isLoading, setIsLoading] = useState(true);

  const { data : user } = useMe();
  

  // Busca idioma do usuário logado
  const { data: userLanguage } = useUserConfiguration<string>('USERCONFIG_LANGUAGE');
  useEffect(() => {
    if (!user && !userLanguage) return;
    setLang(userLanguage?.value || 'pt-BR');
  }, [userLanguage]);


  const { data: themeConfig } = useUserConfiguration<string>('USERCONFIG_THEME')

  useEffect(() => {
    if (!user && themeConfig) {
      setTheme(themeConfig.value);
    }
  }, [themeConfig]);


    useEffect(() => {
     
    if(user !== null && (userLanguage?.value == i18n.language) && (themeConfig?.value == theme)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsLoading(false);
    }
  }, [user, userLanguage, themeConfig, theme, i18n.language]);

  return (
    <AuthContext.Provider
      value={{
        // routes: user?.routes || [],
        isLoading
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
