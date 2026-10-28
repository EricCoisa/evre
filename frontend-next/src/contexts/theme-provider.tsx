'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';


export function ThemeProvider({ children, defaultTheme }: { children: React.ReactNode, defaultTheme?: string }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={defaultTheme ?? 'light'}
      enableSystem={false}
      themes={['light', 'dark']}
    >
      <DefaultTheme defaultTheme={defaultTheme}>
        <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
      </DefaultTheme>
    </NextThemesProvider>
  );
}


function DefaultTheme({ children, defaultTheme }: { children: React.ReactNode, defaultTheme?: string  | undefined }) {
  const { setTheme } = useTheme();
  const seededRef = React.useRef(false);
  React.useEffect(() => {
    // Aplica o tema padrão do servidor uma única vez, na primeira montagem.
    if (defaultTheme && !seededRef.current) {
      seededRef.current = true;
      setTheme(defaultTheme);
    }
  }, [defaultTheme, setTheme]);
  return <>{children}</>;
}