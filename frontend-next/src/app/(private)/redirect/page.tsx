'use server';
import { redirect } from 'next/navigation';
import { getHomeRoute } from '@/lib/actions/access/route/api';

/** Busca a rota home do usuário e redireciona, com proteção contra loop. */
export default async function RedirectPage() {
    const home = await getHomeRoute();
    const targetPath = home?.data?.path;
    if (!targetPath || targetPath === '/redirect') {
      redirect('/access-denied');
    }
    redirect(targetPath);
  return <div>Redirecionando...</div>;
}
