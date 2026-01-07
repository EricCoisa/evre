'use client';

import { LoginForm } from '@/components/auth/login-form';
import Link from 'next/link';
import { Banner } from '@/components/banner';
import { useTranslation } from '@/hooks/use-translation';
import { SystemConfiguration } from '@/lib/actions/systemConfiguration/types';

export function LoginFormComponent ({config}: {config: SystemConfiguration<boolean>}) {
  const { t } = useTranslation('login');
  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <Banner />

      {/* Right side - Login Form */}
      <div className="flex flex-1 flex-col justify-center px-6 py-12 lg:px-12 bg-background">
        <div className="mx-auto w-full max-w-md">
          {/* Mobile branding */}
          <Link href="/" className="lg:hidden flex items-center gap-3 mb-8 group">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center">
              <span className="text-sm font-bold text-white">E</span>
            </div>
            <span className="text-xl font-bold text-foreground transition-colors duration-200">EVRE</span>
          </Link>

          <div className="space-y-8">
            <div className="text-center lg:text-left">
              <h1 className="text-3xl font-bold tracking-tight">
                {t('title')}
              </h1>
              <p className="mt-3 text-muted-foreground text-lg">
                {t('subtitle')}
              </p>
            </div>

            <div className="p-8">
              <LoginForm />
              <p className="text-center text-sm text-muted-foreground mt-2">
                <Link
                  href="/forgot-password"
                  className="text-primary hover:text-primary/80 font-medium transition-colors duration-200"
                >
                  {t('forgotPassword')}
                </Link>
              </p>
            </div>

            {config.value === true && (
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  {t('noAccount')}{' '}
                  <Link
                    href="/signup"
                    className="text-primary hover:text-primary/80 font-medium transition-colors duration-200"
                  >
                    {t('createAccount')}
                  </Link>
                </p>
              </div>
            )}

            <div className="text-center">
              <Link
                href="/"
                className="text-sm text-muted-foreground hover:text-primary transition-colors duration-200 inline-flex items-center gap-2"
              >
                {t('backToHome')}
              </Link>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
