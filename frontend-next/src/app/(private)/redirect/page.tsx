'use server';
import { redirect } from 'next/navigation';
import { getHomeRoute } from '@/lib/actions/access/route/api';

/**
 * Página de redirecionamento inteligente
 * Busca a rota home do usuário e redireciona
 * 
 * PROTEÇÃO ANTI-LOOP:
 * - Se getHomeRoute retornar /access-denied, vai para lá
 * - Se retornar path inválido, vai para /access-denied
 * - Nunca redireciona para /redirect (evita loop)
 */
export default async function RedirectPage() {
    const home = await getHomeRoute();
    const targetPath = home?.data?.path;
    if (!targetPath || targetPath === '/redirect') {
      redirect('/access-denied');
    }
    redirect(targetPath);
  return <div>Redirecionando...</div>;
}
