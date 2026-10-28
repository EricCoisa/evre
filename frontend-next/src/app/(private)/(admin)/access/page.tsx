'use client';

import { Container } from "@/components/container";
import { PageHeader } from "@/components/page-header";
import { SubNavLayout, type SubNavSection, TabsContent } from "@/components/sub-nav-layout";
import { useTranslation } from "@/hooks/use-translation";
import { useTabParam } from "@/hooks/use-tab-param";
import { useEffect, useMemo } from 'react';
import { HelpButton, useTour } from "@/components/tour";
import { UserRoleTab } from "./components/user-role-tab";
import { RoutesTab } from "./components/routes-tab";
import { MainScreenTab } from "./components/main-screen-tab";
import { Shield, Route, Home } from "lucide-react";

export default function AccessPage() {
  const { t } = useTranslation('access');
  const { registerTour } = useTour();
  const [activeTab, setActiveTab] = useTabParam('userRole');

  useEffect(() => {
    registerTour('access', [
      {
        content: t('tour_step1'),
        selectorId: 'access-tab-userRole',
        mobileSelectorId: 'access-content-userRole',
        position: 'bottom',
        onEnter: () => setActiveTab('userRole'),
      },
      {
        content: t('tour_step2'),
        selectorId: 'access-tab-routes',
        mobileSelectorId: 'access-content-routes',
        position: 'bottom',
        onEnter: () => setActiveTab('routes'),
      },
      {
        content: t('tour_step3'),
        selectorId: 'access-tab-main',
        mobileSelectorId: 'access-content-main',
        position: 'bottom',
        onEnter: () => setActiveTab('main'),
      },
    ]);
  }, [registerTour, t, setActiveTab]);

  const sections: SubNavSection[] = useMemo(
    () => [
      {
        items: [
          {
            id: 'userRole',
            idAttr: 'access-tab-userRole',
            label: t('userTab'),
            icon: <Shield className="size-4" />,
          },
          {
            id: 'routes',
            idAttr: 'access-tab-routes',
            label: t('routesTab'),
            icon: <Route className="size-4" />,
          },
          {
            id: 'main',
            idAttr: 'access-tab-main',
            label: t('mainTab'),
            icon: <Home className="size-4" />,
          },
        ],
      },
    ],
    [t]
  );

  return (
    <Container variant="dataTable" border={false}>
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={<HelpButton tourId="access" startDirect />}
      />
      <SubNavLayout
        sections={sections}
        defaultTab="userRole"
        tab={activeTab}
        onTabChange={setActiveTab}
      >
        <TabsContent value="userRole" id="access-content-userRole" className="mt-0 space-y-4">
          <UserRoleTab t={t} />
        </TabsContent>
        <TabsContent value="routes" id="access-content-routes" className="mt-0 space-y-4">
          <RoutesTab t={t} />
        </TabsContent>
        <TabsContent value="main" id="access-content-main" className="mt-0 space-y-4">
          <MainScreenTab t={t} />
        </TabsContent>
      </SubNavLayout>
    </Container>
  );
}
