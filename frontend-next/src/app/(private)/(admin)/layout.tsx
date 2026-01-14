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

  // Se não tem acesso, redireciona para encontrar rota permitida
  // IMPORTANTE: Evita redirect duplo que pode causar loop
  if (!hasAccess) {
    redirect('/redirect');
  }

  // Usuário tem acesso, renderiza conteúdo
  return <>{children}</>;
}
