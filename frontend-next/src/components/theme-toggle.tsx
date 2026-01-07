'use client';

import * as React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { useUserConfiguration, useSetUserConfiguration } from '@/lib/actions/userConfiguration/queries';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const { data: themeConfig, isFetched, isError } = useUserConfiguration<string>('USERCONFIG_THEME');
  const updateUserConfig = useSetUserConfiguration();

  // Necessário para prevenir hydration mismatch
  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (mounted) {
      setTheme(themeConfig?.value as string || 'light');
    }
  }, [themeConfig]);

  const handleToggle = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';

    // Salva a preferência do usuário no banco
    if (themeConfig?.id) {
      try {
        setTheme(newTheme);

        await updateUserConfig.mutateAsync({
          userConfiguration: {
            ...themeConfig,
            value: newTheme
          }
        });
      } catch (error) {
        console.error('❌ Failed to save theme:', error);
      }
    } else {
      // Fallback se não houver configuração
      setTheme(newTheme);
    }
  };

  if (!mounted) {
    return null;
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleToggle}
      className="size-8"
    >
      {theme === 'light' ? (
        <Moon className="size-4" />
      ) : (
        <Sun className="size-4" />
      )}
      <span className="sr-only">Alternar tema</span>
    </Button>
  );
}
