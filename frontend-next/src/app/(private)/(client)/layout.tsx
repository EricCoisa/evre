import { validateRouteAccess } from '@/lib/actions/auth/server-auth';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { logger } from '@/lib/logger';

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Pega a rota atual do middleware
  const headersList = await headers();
  const pathname = headersList.get('x-pathname') || '/';
  logger.info('client-layout', `pathname: ${pathname}`);
  
  // Valida acesso ao contexto client
  logger.info('client-layout', 'Validando acesso...');
  const { user, hasAccess } = await validateRouteAccess(pathname, 'client');
  logger.info('client-layout', 'Dados do usuário', { 
    userId: user.id, 
    email: user.email, 
    companyId: user.companyId,
    hasAccess 
  });

  // Cliente PRECISA ter companyId
  if (!user.companyId) {
    logger.warn('client-layout', 'Cliente SEM companyId, redirecionando para /redirect');
    redirect('/redirect');
  }

  // Se não tem acesso à rota específica, redireciona
  if (!hasAccess) {
    logger.warn('client-layout', 'SEM ACESSO, redirecionando para /access-denied');
    redirect('/access-denied');
  }

  logger.info('client-layout', 'TEM ACESSO - renderizando children');
  // Usuário tem acesso, renderiza conteúdo
  return <>{children}</>;
}
