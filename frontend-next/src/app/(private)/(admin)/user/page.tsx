'use client';

import { Container } from '@/components/container';
import { PageHeader } from '@/components/page-header';
import { SubNavLayout, type SubNavSection, TabsContent } from '@/components/sub-nav-layout';
import { UserTab } from './components/user-tab';
import { InviteTab } from './components/invite-tab';
import { Users, Mail } from 'lucide-react';
import { useTranslation } from '@/hooks/use-translation';
import { useTabParam } from '@/hooks/use-tab-param';
import { HelpButton, useTour } from '@/components/tour';
import { useEffect, useMemo } from 'react';

export default function UsersPage() {
  const { t } = useTranslation('users');
  const { registerTour } = useTour();
  const [activeTab, setActiveTab] = useTabParam('users');

  useEffect(() => {
    registerTour('users', [
      {
        content: t('tour_step_users'),
        selectorId: 'user-tab-users',
        mobileSelectorId: 'user-content-users',
        position: 'bottom',
        onEnter: () => setActiveTab('users'),
      },
      {
        content: t('tour_step_new_user'),
        selectorId: 'btn-new-user',
        position: 'bottom',
        onEnter: () => setActiveTab('users'),
      },
      {
        content: t('tour_step_invites'),
        selectorId: 'user-tab-invites',
        mobileSelectorId: 'user-content-invites',
        position: 'bottom',
        onEnter: () => setActiveTab('invites'),
      },
      {
        content: t('tour_step_new_invite'),
        selectorId: 'btn-new-invite',
        position: 'bottom',
        onEnter: () => setActiveTab('invites'),
      },
    ]);
  }, [registerTour, t, setActiveTab]);

  const userSections: SubNavSection[] = useMemo(
    () => [
      {
        items: [
          {
            id: 'users',
            idAttr: 'user-tab-users',
            label: t('tabUsers'),
            icon: <Users className="size-4" />,
          },
          {
            id: 'invites',
            idAttr: 'user-tab-invites',
            label: t('tabInvites'),
            icon: <Mail className="size-4" />,
          },
        ],
      },
    ],
    [t]
  );

  return (
    <Container variant="dataTable" border={false}>
      <PageHeader
        title={t('userManagement')}
        description={t('description')}
        actions={<HelpButton tourId="users" startDirect />}
      />
      <SubNavLayout
        sections={userSections}
        defaultTab="users"
        tab={activeTab}
        onTabChange={setActiveTab}
      >
        <TabsContent value="users" id="user-content-users" className="mt-0 space-y-4">
          <UserTab />
        </TabsContent>

        <TabsContent value="invites" id="user-content-invites" className="mt-0 space-y-4">
          <InviteTab />
        </TabsContent>
      </SubNavLayout>
    </Container>
  );
}
