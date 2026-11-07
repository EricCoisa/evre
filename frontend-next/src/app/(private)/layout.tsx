import { isServerAuthenticated } from '@/lib/actions/auth/server-auth';
import { serverFeatureFlag } from '@/lib/server-context';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { Header } from '@/components/header';
import { ReactTour } from '@/components/ui/reactTour';
import { BreadProvider } from '@/contexts/bread-context';
import { AuthHydration } from '@/contexts/auth-hydration';
import { AsyncBoundary } from '@/components/async-boundary';
import { FullPageLoader } from '@/components/ui/full-page-loader';
import { FilterSidebarProvider } from '@/contexts/filter-sidebar-context';
import { CMSProvider } from '@/contexts/cms-context';
import { CMSLayoutWrapper } from '@/components/cms-layout-wrapper';
import { redirect } from 'next/navigation';

import { AgentWindow } from '@/components/agent/agent-window';
import AgentChatProvider from '@/components/agent/agent-chat-provider';
import { MessagingChatProvider } from '@/components/messaging/messaging-chat-provider';

export default async function PrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Apenas valida se está autenticado (não verifica permissões específicas)
  const isAuthenticated = await isServerAuthenticated();

  if (!isAuthenticated) {
    redirect('/login');
  }

  // Decisão de servidor: com a flag off, componentes nem montam — zero chamada desnecessária ao backend.
  const notificationsEnabled = await serverFeatureFlag('NOTIFICATION');
  const timeTrackingEnabled = await serverFeatureFlag('FEATURE_TIME_TRACKING');

  return (
    // Boundary mais externo do app privado: o AuthHydration suspende até `me`, idioma
    // e tema chegarem, e tudo abaixo já monta com o cache quente.
    <AsyncBoundary fallback={<FullPageLoader />}>
      <AuthHydration>
        <ReactTour>
          <FilterSidebarProvider>
            <CMSProvider>
              <AgentChatProvider>
                {/* Janelas de conversa (portal no body): sobrevivem à navegação entre páginas. */}
                <MessagingChatProvider>
                  <SidebarProvider>
                    <AppSidebar />
                    <SidebarInset className="flex flex-col min-h-screen  w-full max-w-full overflow-x-auto bg-background">
                      <BreadProvider>
                        <Header
                          notificationsEnabled={notificationsEnabled}
                          timeTrackingEnabled={timeTrackingEnabled}
                        />
                        <CMSLayoutWrapper>
                          {children}
                        </CMSLayoutWrapper>
                      </BreadProvider>
                    </SidebarInset>
                  </SidebarProvider>
                  {/* Fora do SidebarInset: a janela/balão flutuam sobre todo o layout privado */}
                  <AgentWindow />
                </MessagingChatProvider>
              </AgentChatProvider>
            </CMSProvider>
          </FilterSidebarProvider>
        </ReactTour>
      </AuthHydration>
    </AsyncBoundary>
  );
}
