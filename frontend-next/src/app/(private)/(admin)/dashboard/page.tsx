import { PageRenderer } from "@/lib/page-builder/renderer";
import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import { Container } from "@/components/container";
import { serverFeatureFlag } from "@/lib/server-context";

/** Server Component que avalia a flag BETA_DASHBOARD e monta o fallback do PageRenderer. */
export default async function DashboardPage() {
  const showBetaDashboard = await serverFeatureFlag('BETA_DASHBOARD');

  // Opt-in por página: o PageRenderer só assume se o usuário tiver um layout salvo E a flag
  // PAGE_BUILDER estiver ligada. Qualquer outro caso renderiza o dashboard em código.
  return (
    <PageRenderer
      pageKey="/dashboard"
      fallback={
        <div className="sm:px-6 px-0 grid grid-cols-1 lg:grid-cols-2 gap-6 auto-rows-fr">
          {showBetaDashboard && (
            <Container className="lg:col-span-2">
              <ChartAreaInteractive />
            </Container>
          )}
        </div>
      }
    />
  );
}
