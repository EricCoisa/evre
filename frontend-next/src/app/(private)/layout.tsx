import { validateServerAuth } from '@/lib/actions/auth/server-auth';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { Header } from '@/components/header';
import { PageTitle } from '@/components/page-title';
import { PrefetchWrapper } from './prefetch-wrapper';
import { ReactTour } from '@/components/ui/reactTour';
import { BreadProvider } from '@/contexts/bread-context';
import { AuthProvider } from '@/contexts/auth-context';
import { AppProvider } from '@/contexts/appProvider';
import { FilterSidebarProvider } from '@/contexts/filter-sidebar-context';
import { headers } from 'next/headers';

export default async function PrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Pega a rota atual do middleware
  const headersList = await headers();
  const pathname = headersList.get('x-pathname') || '/';
  
  // Valida autenticação e acesso à rota
  await validateServerAuth(pathname);

  console.log('PrivateLayout pathname recebido:', pathname);

  return (
    <AppProvider>
      <AuthProvider>
        <PrefetchWrapper>
          <ReactTour>
            <FilterSidebarProvider>
              <SidebarProvider>
                <AppSidebar />
                <SidebarInset className="flex flex-col min-h-screen bg-background">
                  <BreadProvider>
                    <Header />

                    <main className="flex-1 flex flex-col gap-6 p-3 lg:p-6">
                      <PageTitle />
                      <div className="flex-1">
                        {children}
                      </div>
                    </main>
                  </BreadProvider>
                </SidebarInset>
              </SidebarProvider>
            </FilterSidebarProvider>
          </ReactTour>
        </PrefetchWrapper>
      </AuthProvider>
    </AppProvider>
  );
}
