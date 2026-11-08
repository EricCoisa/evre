import { Container } from "@/components/container";
import { AsyncBoundary } from "@/components/async-boundary";
import { type SubNavSection, TabsContent } from "@/components/sub-nav-layout";
import LangLabel from "@/components/ui/langLabel";
import CompositeLangLabel from "@/components/ui/compositeLangLabel";
import { CAPABILITIES } from "@/types/capabilities";
import { serverFeatureFlags } from "@/lib/server-context";
import { SystemConfig } from "./components/system-config-tab";
import { UserDefaultConfig } from "./components/user-default-config-tab";
import { EmailConfig } from "./components/email-config-tab";
import { StorageConfig } from "./components/storage-config-tab";
import { AiConfig } from "./components/ai-config-tab";
import { OAuthConfig } from "./components/oauth-config-tab";
import { CaptchaConfig } from "./components/captcha-config-tab";
import { MessagingConfig } from "./components/messaging-config-tab";
import { NotificationConfig } from "./components/notification-config-tab";
import { TimeTrackingConfig } from "./components/time-tracking-config-tab";
import { SettingsTourLayout } from "./components/settings-tour-layout";
import {
  Sliders,
  Users,
  Bell,
  Mail,
  HardDrive,
  ShieldCheck,
  KeyRound,
  Bot,
  MessageSquare,
  Clock,
} from "lucide-react";

interface SettingsFlags {
  aiAgent: boolean;
  oauth: boolean;
  messaging: boolean;
  notification: boolean;
  timeTracking: boolean;
}

function getSettingsSections(flags: SettingsFlags): SubNavSection[] {
  return [
    {
      id: 'general',
      idAttr: 'settings-section-general',
      title: <LangLabel text="settings_section_general" langJson="settings" />,
      items: [
        {
          id: 'systemConfig',
          idAttr: 'settings-tab-systemConfig',
          label: <LangLabel text="systemConfiguration" langJson="settings" />,
          icon: <Sliders className="size-4" />,
        },
        {
          id: 'userConfig',
          idAttr: 'settings-tab-userConfig',
          label: <LangLabel text="userConfiguration" langJson="settings" />,
          icon: <Users className="size-4" />,
        },
        {
          id: 'notificationConfig',
          idAttr: 'settings-tab-notificationConfig',
          label: <LangLabel text="notificationConfiguration" langJson="settings" />,
          icon: <Bell className="size-4" />,
          hidden: !flags.notification,
        },
        {
          id: 'timeTrackingConfig',
          idAttr: 'settings-tab-timeTrackingConfig',
          label: <LangLabel text="timeTrackingConfiguration" langJson="settings" />,
          icon: <Clock className="size-4" />,
          hidden: !flags.timeTracking,
        },
      ],
    },
    {
      id: 'infrastructure',
      idAttr: 'settings-section-infrastructure',
      title: <LangLabel text="settings_section_infrastructure" langJson="settings" />,
      items: [
        {
          id: 'emailConfig',
          idAttr: 'settings-tab-emailConfig',
          label: <LangLabel text="emailConfiguration" langJson="settings" />,
          icon: <Mail className="size-4" />,
        },
        {
          id: 'storageConfig',
          idAttr: 'settings-tab-storageConfig',
          label: <LangLabel text="storageConfiguration" langJson="settings" />,
          icon: <HardDrive className="size-4" />,
        },
        {
          id: 'captchaConfig',
          idAttr: 'settings-tab-captchaConfig',
          label: <LangLabel text="captchaConfiguration" langJson="settings" />,
          icon: <ShieldCheck className="size-4" />,
        },
        {
          id: 'oauthConfig',
          idAttr: 'settings-tab-oauthConfig',
          label: <LangLabel text="oauthConfiguration" langJson="settings" />,
          icon: <KeyRound className="size-4" />,
          hidden: !flags.oauth,
        },
      ],
    },
    {
      id: 'ai-channels',
      idAttr: 'settings-section-ai-channels',
      title: (
        <CompositeLangLabel
          langJson="settings"
          compoundKey="settings_section_ai_channels"
          parts={[
            { text: 'settings_section_ai', active: flags.aiAgent },
            {
              text: 'settings_section_channels',
              active: flags.messaging,
              capability: CAPABILITIES.messaging,
            },
          ]}
        />
      ),
      items: [
        {
          id: 'agenteConfig',
          idAttr: 'settings-tab-agenteConfig',
          label: <LangLabel text="agentConfiguration" langJson="settings" />,
          icon: <Bot className="size-4" />,
          hidden: !flags.aiAgent,
        },
        {
          id: 'messagingConfig',
          idAttr: 'settings-tab-messagingConfig',
          label: <LangLabel text="messagingConfiguration" langJson="settings" />,
          icon: <MessageSquare className="size-4" />,
          hidden: !flags.messaging,
        },
      ],
    },
  ];
}

function SettingsTabsContent({ flags }: { flags: SettingsFlags }) {
  return (
    <AsyncBoundary>
      <TabsContent value="systemConfig" id="settings-content-systemConfig"><SystemConfig /></TabsContent>
      <TabsContent value="userConfig" id="settings-content-userConfig"><UserDefaultConfig /></TabsContent>
      <TabsContent value="emailConfig" id="settings-content-emailConfig"><EmailConfig /></TabsContent>
      <TabsContent value="storageConfig" id="settings-content-storageConfig"><StorageConfig /></TabsContent>
      <TabsContent value="captchaConfig" id="settings-content-captchaConfig"><CaptchaConfig /></TabsContent>
      {flags.aiAgent && <TabsContent value="agenteConfig" id="settings-content-agenteConfig"><AiConfig /></TabsContent>}
      {flags.oauth && <TabsContent value="oauthConfig" id="settings-content-oauthConfig"><OAuthConfig /></TabsContent>}
      {flags.messaging && <TabsContent value="messagingConfig" id="settings-content-messagingConfig"><MessagingConfig /></TabsContent>}
      {flags.notification && <TabsContent value="notificationConfig" id="settings-content-notificationConfig"><NotificationConfig /></TabsContent>}
      {flags.timeTracking && <TabsContent value="timeTrackingConfig" id="settings-content-timeTrackingConfig"><TimeTrackingConfig /></TabsContent>}
    </AsyncBoundary>
  );
}

/** Server Component: as flags são avaliadas aqui, então a aba negada não entra no payload RSC. */
export default async function SettingsPage() {
  const flags = await serverFeatureFlags();
  const settingsFlags: SettingsFlags = {
    aiAgent: Boolean(flags['AI_AGENT']),
    oauth: Boolean(flags['OAUTH_LOGIN']),
    messaging: Boolean(flags['MESSAGING']),
    notification: Boolean(flags['NOTIFICATION']),
    timeTracking: Boolean(flags['FEATURE_TIME_TRACKING']),
  };

  const sections = getSettingsSections(settingsFlags);

  return (
    <Container variant="dataTable" border={false}>
      <SettingsTourLayout sections={sections} flags={settingsFlags}>
        <SettingsTabsContent flags={settingsFlags} />
      </SettingsTourLayout>
    </Container>
  );
}
