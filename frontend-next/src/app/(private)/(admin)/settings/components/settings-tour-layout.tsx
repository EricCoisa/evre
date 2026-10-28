'use client';

import { useEffect, type ReactNode } from 'react';
import { PageHeader } from '@/components/page-header';
import { SubNavLayout, type SubNavSection } from '@/components/sub-nav-layout';
import {
  HelpButton,
  useTour,
  type TourStep,
  filterStepsBySubNavSections,
} from '@/components/tour';
import { CAPABILITIES } from '@/types/capabilities';
import { useTabParam } from '@/hooks/use-tab-param';
import { useTranslation } from '@/hooks/use-translation';

interface SettingsTourLayoutProps {
  sections: SubNavSection[];
  children: ReactNode;
  flags: {
    aiAgent: boolean;
    oauth: boolean;
    messaging: boolean;
    notification: boolean;
  };
}

export function SettingsTourLayout({ sections, children, flags }: SettingsTourLayoutProps) {
  const { t } = useTranslation('settings');
  const { registerTour } = useTour();
  const [activeTab, setActiveTab] = useTabParam('systemConfig');

  useEffect(() => {
    const allSteps: TourStep[] = [
      {
        content: t('tour_settings_intro'),
        tabId: 'systemConfig',
        selectorId: 'settings-tab-systemConfig',
        mobileSelectorId: 'settings-content-systemConfig',
        position: 'bottom',
        onEnter: () => setActiveTab('systemConfig'),
      },
      {
        content: t('tour_settings_email'),
        tabId: 'emailConfig',
        capability: CAPABILITIES.email,
        selectorId: 'settings-tab-emailConfig',
        mobileSelectorId: 'settings-content-emailConfig',
        position: 'bottom',
        onEnter: () => setActiveTab('emailConfig'),
      },
      {
        content: t('tour_settings_storage'),
        tabId: 'storageConfig',
        selectorId: 'settings-tab-storageConfig',
        mobileSelectorId: 'settings-content-storageConfig',
        position: 'bottom',
        onEnter: () => setActiveTab('storageConfig'),
      },
      {
        content: t('tour_settings_captcha'),
        tabId: 'captchaConfig',
        capability: CAPABILITIES.captcha,
        selectorId: 'settings-tab-captchaConfig',
        mobileSelectorId: 'settings-content-captchaConfig',
        position: 'bottom',
        onEnter: () => setActiveTab('captchaConfig'),
      },
      {
        content: t('tour_settings_oauth'),
        tabId: 'oauthConfig',
        hidden: !flags.oauth,
        selectorId: 'settings-tab-oauthConfig',
        mobileSelectorId: 'settings-content-oauthConfig',
        position: 'bottom',
        onEnter: () => setActiveTab('oauthConfig'),
      },
      {
        content: t('tour_settings_notification'),
        tabId: 'notificationConfig',
        hidden: !flags.notification,
        selectorId: 'settings-tab-notificationConfig',
        mobileSelectorId: 'settings-content-notificationConfig',
        position: 'bottom',
        onEnter: () => setActiveTab('notificationConfig'),
      },
      {
        content: t('tour_settings_messaging'),
        tabId: 'messagingConfig',
        capability: CAPABILITIES.messaging,
        hidden: !flags.messaging,
        selectorId: 'settings-tab-messagingConfig',
        mobileSelectorId: 'settings-content-messagingConfig',
        position: 'bottom',
        onEnter: () => setActiveTab('messagingConfig'),
      },
      {
        content: t('tour_settings_ai'),
        tabId: 'agenteConfig',
        hidden: !flags.aiAgent,
        selectorId: 'settings-tab-agenteConfig',
        mobileSelectorId: 'settings-content-agenteConfig',
        position: 'bottom',
        onEnter: () => setActiveTab('agenteConfig'),
      },
    ];

    const steps = filterStepsBySubNavSections(allSteps, sections);
    registerTour('settings-general', steps);
  }, [flags.aiAgent, flags.messaging, flags.notification, flags.oauth, registerTour, sections, setActiveTab, t]);

  return (
    <>
      <PageHeader
        title={t('settings_title')}
        description={t('settings_description')}
        actions={<HelpButton tourId="settings-general" startDirect />}
      />
      <SubNavLayout
        sections={sections}
        defaultTab="systemConfig"
        tab={activeTab}
        onTabChange={setActiveTab}
      >
        {children}
      </SubNavLayout>
    </>
  );
}

