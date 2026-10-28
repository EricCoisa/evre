'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { loginSchema, type LoginFormData } from '@/lib/schemas/login.schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/hooks/use-translation';
import { loginClient } from '@/lib/actions/auth/auth-action';
import type { CaptchaTokenControl } from '@/hooks/use-captcha';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
} from '@/components/ui/form';

const NO_CAPTCHA: CaptchaTokenControl = {
  getToken: async () => null,
  enabled: false,
};

// Rejects non-relative and protocol-relative paths to prevent open redirect
function safeCallbackUrl(url: string | undefined): string | null {
  if (!url) return null;
  if (!url.startsWith('/') || url.startsWith('//') || url.includes('://')) return null;
  return url;
}

export function LoginForm({
  callbackUrl,
  captchaControl = NO_CAPTCHA,
}: {
  callbackUrl?: string;
  captchaControl?: CaptchaTokenControl;
}) {
  const { t } = useTranslation('login');
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getToken, enabled: captchaEnabled } = captchaControl;

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const captchaToken = await getToken();
      // Widget ligado mas não resolvido: avisa aqui em vez de deixar o backend
      // devolver 403 depois de uma ida e volta.
      if (captchaEnabled && !captchaToken) {
        setError(t('common:captchaRequired'));
        setIsLoading(false);
        return;
      }

      await loginClient(data, router, captchaToken);
      const safe = safeCallbackUrl(callbackUrl);
      if (safe) router.push(safe);
    } catch (err) {
      console.error('Login error:', err);
      setIsLoading(false);
      setError(err instanceof Error && err.message ? err.message : t('common:errorMessage'));
    }
  };

  return (
    <Form {...form}>
      <form method="post" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 w-full max-w-sm">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('email')}</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder={t('emailPlaceholder')}
                  disabled={isLoading}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('password')}</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="••••••"
                  disabled={isLoading}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? t('submitting') : t('common:login')}
        </Button>
      </form>
    </Form>
  );
}
