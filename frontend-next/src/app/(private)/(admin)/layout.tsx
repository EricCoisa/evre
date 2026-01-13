import { validateRouteAccess } from '@/lib/actions/auth/server-auth';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Pega a rota atual do middleware
  const headersList = await headers();
  const pathname = headersList.get('x-pathname') || '/';
  
  // Valida acesso ao contexto admin
  const { user, hasAccess } = await validateRouteAccess(pathname, 'admin');

  // Se não tem acesso, redireciona
  if (!hasAccess) {
    // Se usuário tem companyId, redireciona para área client
    if (user.companyId) {
      redirect('/redirect');
    }
    // Caso contrário, redireciona para /redirect (que encontrará a primeira rota permitida)
    redirect('/redirect');
  }

  // Usuário tem acesso, renderiza conteúdo
  return <>{children}</>;
}
