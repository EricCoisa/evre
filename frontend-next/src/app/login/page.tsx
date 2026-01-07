'use server';

import { getServerAccessToken } from '@/lib/actions/auth/server-auth';
import { redirect } from 'next/navigation';
import { getSignupConfiguration } from '@/lib/actions/systemConfiguration/api';
import { LoginFormComponent } from './components/login-form';

export default async function LoginPage() {
  const accessToken = await getServerAccessToken();
  if (accessToken) {
    redirect('/redirect');
  }
  const config = (await getSignupConfiguration()).data;
  return (
    <LoginFormComponent config={config} />
  );
}
