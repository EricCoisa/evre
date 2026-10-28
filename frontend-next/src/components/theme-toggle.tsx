'use client';

import * as React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { useUserConfiguration, useSetUserConfiguration } from '@/lib/actions/userConfiguration/queries';
import { USER_CONFIG_KEYS } from '@/types/user-config-keys';
import { useHasMounted } from '@/hooks/use-has-mounted';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useHasMounted();
  const { data: themeConfig } = useUserConfiguration<string>(USER_CONFIG_KEYS.theme);
  const updateUserConfig = useSetUserConfiguration();
  const seededRef = React.useRef(false);

  React.useEffect(() => {
    if (mounted && !seededRef.current) {
      seededRef.current = true;
      setTheme(themeConfig?.value as string || 'light');
    }
  }, [themeConfig, mounted, setTheme]);

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
