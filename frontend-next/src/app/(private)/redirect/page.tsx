'use server';
import { redirect } from 'next/navigation';
import { getHomeRoute } from '@/lib/actions/access/route/api';
import { logger } from '@/lib/logger';

export default async function RedirectPage() {
  logger.info('redirect-page', 'Iniciando RedirectPage');
  const home = await getHomeRoute();
  logger.info('redirect-page', 'Rota home encontrada', { path: home.data.path });
  redirect(home.data.path);

  return <div>Redirecionando...</div>;
}
