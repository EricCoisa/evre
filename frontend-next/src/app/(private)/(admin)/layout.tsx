import { validateRouteAccess } from '@/lib/actions/auth/server-auth';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { logger } from '@/lib/logger';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Pega a rota atual do middleware
  const headersList = await headers();
  const pathname = headersList.get('x-pathname') || '/';
  logger.info('admin-layout', `pathname: ${pathname}`);
  
  // Valida acesso ao contexto admin
  logger.info('admin-layout', 'Validando acesso...');
  const { user, hasAccess } = await validateRouteAccess(pathname, 'admin');
  logger.info('admin-layout', 'Dados do usuário', { 
    userId: user.id, 
    email: user.email, 
    companyId: user.companyId,
    hasAccess 
  });

  // Se não tem acesso, redireciona
  if (!hasAccess) {
    logger.warn('admin-layout', 'SEM ACESSO - iniciando redirect');
    // Se usuário tem companyId, redireciona para área client
    if (user.companyId) {
      logger.info('admin-layout', 'Usuário tem companyId, redirecionando para /redirect');
      redirect('/redirect');
    }
    // Caso contrário, redireciona para /redirect (que encontrará a primeira rota permitida)
    logger.info('admin-layout', 'Usuário SEM companyId, redirecionando para /redirect');
    redirect('/redirect');
  }

  logger.info('admin-layout', 'TEM ACESSO - renderizando children');
  // Usuário tem acesso, renderiza conteúdo
  return <>{children}</>;
}
