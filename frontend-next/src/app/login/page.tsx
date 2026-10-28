'use server';

import { getServerAccessToken } from '@/lib/actions/auth/server-auth';
import { redirect } from 'next/navigation';
import { getSignupConfiguration } from '@/lib/actions/systemConfiguration/api';
import { getOAuthProviders, getForgotPasswordStatus } from '@/lib/actions/auth/api';
import { getCaptchaConfig } from '@/lib/actions/captcha/api';
import { LoginFormComponent } from './components/login-form';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string; error?: string; expired?: string }> }) {
  const accessToken = await getServerAccessToken();
  if (accessToken) {
    redirect('/redirect');
  }
  const [config, oauthProviders, captcha, forgotPasswordStatus] =  await Promise.all([
    getSignupConfiguration().then((res) => res.data),
    // Providers OAuth configurados e habilitados para exibir no login
    getOAuthProviders().then((res) => (res.data ?? []).filter((p) => p.configured && p.enabled)),
    // Captcha desligado devolve `enabled: false` e o formulário não desenha nada.
    getCaptchaConfig().then((res) => res.data),
    getForgotPasswordStatus().then((res) => res.data),
  ]);
  const { callbackUrl, error, expired } = await searchParams;
  return (
    <LoginFormComponent
      config={config}
      oauthProviders={oauthProviders}
      callbackUrl={callbackUrl}
      oauthError={error === 'oauth'}
      // `expired=1` vem do middleware quando o refresh token já não renova a sessão.
      sessionExpired={expired === '1'}
      captcha={captcha}
      forgotPasswordAvailable={forgotPasswordStatus?.available === true}
    />
  );
}
