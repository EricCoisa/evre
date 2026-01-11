'use server';
import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/actions/auth/api';

export default async function RedirectPage() {
  const user = await getProfile();
  const home = user.data?.routes.find(route => route.isHome);
  console.log('Redirecionando para a rota home do usuário:', home?.path);
  redirect(home?.path || '/home');

  return <div>Redirecionando...</div>;
}
