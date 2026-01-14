import { validateRouteAccess } from '@/lib/actions/auth/server-auth';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Pega a rota atual do middleware
  const headersList = await headers();
  const pathname = headersList.get('x-pathname') || '/';
  
  // Valida acesso ao contexto client
  const { user, hasAccess } = await validateRouteAccess(pathname, 'client');

  // Cliente PRECISA ter companyId
  // Se não tem, redireciona para /redirect (evita loop verificando pathname)
  if (!user.companyId) {
    // Proteção anti-loop: se já está em /redirect, não redireciona novamente
    if (pathname !== '/redirect') {
      redirect('/redirect');
    }
    // Se já está em redirect mas não tem companyId, vai para access-denied
    redirect('/access-denied');
  }

  // Se não tem acesso à rota específica, redireciona
  if (!hasAccess) {
    redirect('/access-denied');
  }

  // Usuário tem acesso, renderiza conteúdo
  return <>{children}</>;
}
