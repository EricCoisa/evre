'use client';

import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import { Container } from "@/components/container";
import { useTranslation } from "@/hooks/use-translation";

export default function DashboardPage() {

  const { t } = useTranslation('dashboard');

  return (
    <div className="sm:px-6 px-0 grid grid-cols-1 lg:grid-cols-2 gap-6 auto-rows-fr">
      {/* Container de Estatísticas */}
      <Container  className="lg:col-span-2">
        <ChartAreaInteractive />
      </Container>

      {/* Container de Atividades Recentes */}
      <Container padding variant="default" title={t('recentActivities')} className="lg:col-span-2">
        <div className="space-y-4 pt-4">
          <div className="flex items-start gap-4">
            <div className="h-2 w-2 mt-2 rounded-full bg-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{t('loginPerformed')}</p>
              <p className="text-xs text-muted-foreground">{t('adminLoggedIn')}</p>
              <p className="text-xs text-muted-foreground/60 mt-1">{t('minutesAgo', { '0': '2' })}</p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="h-2 w-2 mt-2 rounded-full bg-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{t('systemStarted')}</p>
              <p className="text-xs text-muted-foreground">{t('backendFrontendOperational')}</p>
              <p className="text-xs text-muted-foreground/60 mt-1">{t('minutesAgo', { '0': '10' })}</p>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
