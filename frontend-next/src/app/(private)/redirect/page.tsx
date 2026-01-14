'use server';
import { redirect } from 'next/navigation';
import { getHomeRoute } from '@/lib/actions/access/route/api';

export default async function RedirectPage() {
  const home = await getHomeRoute();
  console.log('Redirecionando para a rota home do usuário:', home.data.path);
  redirect(home.data.path);

  return <div>Redirecionando...</div>;
}
