import { Container } from "@/components/container";
import { PageHeader } from "@/components/page-header";
import { AsyncBoundary } from "@/components/async-boundary";
import { SubNavLayout, type SubNavSection, TabsContent } from "@/components/sub-nav-layout";
import LangLabel from "@/components/ui/langLabel";
import CompositeLangLabel from "@/components/ui/compositeLangLabel";
import { serverAiHealth, serverFeatureFlags } from "@/lib/server-context";
import { ProfileInfoTab } from "./components/profile-info-tab";
import { SecurityTab } from "./components/security-tab";
import { PreferencesTab } from "./components/preferences-tab";
import { NotificationPreferencesTab } from "./components/notification-preferences-tab";
import { AccountTab } from "./components/account-tab";
import { AgentConfigTab } from "./components/agent-config-tab";
import { AgentPermissionsTab } from "./components/agent-permissions-tab";
import { ApiKeysTab } from "./components/api-keys-tab";
import { ConnectorsTab } from "./components/connectors-tab";
import {
  User,
  Shield,
  Sliders,
  Bell,
  Settings,
  KeyRound,
  Plug,
  Bot,
  ShieldCheck,
} from "lucide-react";

interface ProfileFlags {
  mcpApiKeys: boolean;
  mcpConnectors: boolean;
  aiAgent: boolean;
  notifications: boolean;
  byokRequired: boolean;
  messaging: boolean;
}

function getProfileSections(flags: ProfileFlags): SubNavSection[] {
  return [
    {
      title: <LangLabel text="profile_section_account" langJson="profile" />,
      items: [
        {
          id: 'profile',
          label: <LangLabel text="tab_profile" langJson="profile" />,
          icon: <User className="size-4" />,
        },
        {
          id: 'security',
          label: <LangLabel text="tab_security" langJson="profile" />,
          icon: <Shield className="size-4" />,
        },
        {
          id: 'preferences',
          label: <LangLabel text="tab_preferences" langJson="profile" />,
          icon: <Sliders className="size-4" />,
        },
        {
          id: 'notifications',
          label: <LangLabel text="tab_notifications" langJson="profile" />,
          icon: <Bell className="size-4" />,
          hidden: !flags.notifications,
        },
        {
          id: 'account',
          label: <LangLabel text="tab_account" langJson="profile" />,
          icon: <Settings className="size-4" />,
        },
      ],
    },
    {
      title: (
        <CompositeLangLabel
          langJson="profile"
          compoundKey="profile_section_ai_connections"
          parts={[
            { text: 'profile_section_ai', active: flags.byokRequired || flags.aiAgent },
            { text: 'profile_section_connections', active: flags.mcpApiKeys || flags.mcpConnectors },
          ]}
        />
      ),
      items: [
        {
          id: 'apiKeys',
          label: <LangLabel text="tab_apiKeys" langJson="profile" />,
          icon: <KeyRound className="size-4" />,
          hidden: !flags.mcpApiKeys,
        },
        {
          id: 'connectors',
          label: <LangLabel text="tab_connectors" langJson="profile" />,
          icon: <Plug className="size-4" />,
          hidden: !flags.mcpConnectors,
        },
        {
          id: 'agenteConfig',
          label: <LangLabel text="tab_agentConfig" langJson="profile" />,
          icon: <Bot className="size-4" />,
          hidden: !flags.byokRequired,
        },
        {
          id: 'agentPermissions',
          label: <LangLabel text="tab_agentPermissions" langJson="profile" />,
          icon: <ShieldCheck className="size-4" />,
          hidden: !flags.aiAgent,
        },
      ],
    },
  ];
}

function ProfileTabsContent({ flags }: { flags: ProfileFlags }) {
  return (
    <AsyncBoundary>
      <TabsContent value="profile"><ProfileInfoTab messagingEnabled={flags.messaging} /></TabsContent>
      <TabsContent value="security"><SecurityTab /></TabsContent>
      <TabsContent value="preferences"><PreferencesTab /></TabsContent>
      {flags.notifications && <TabsContent value="notifications"><NotificationPreferencesTab /></TabsContent>}
      {flags.mcpApiKeys && <TabsContent value="apiKeys"><ApiKeysTab /></TabsContent>}
      {flags.mcpConnectors && <TabsContent value="connectors"><ConnectorsTab /></TabsContent>}
      {flags.byokRequired && <TabsContent value="agenteConfig"><AgentConfigTab /></TabsContent>}
      {flags.aiAgent && <TabsContent value="agentPermissions"><AgentPermissionsTab /></TabsContent>}
      <TabsContent value="account"><AccountTab /></TabsContent>
    </AsyncBoundary>
  );
}

/** Server Component: flags decidem aqui quais abas chegam ao browser. */
export default async function ProfilePage() {
  const [flags, health] = await Promise.all([
    serverFeatureFlags(),
    serverAiHealth(),
  ]);

  const profileFlags: ProfileFlags = {
    mcpApiKeys: Boolean(flags['MCP_API_KEYS']),
    mcpConnectors: Boolean(flags['MCP_CONNECTORS']),
    aiAgent: Boolean(flags['AI_AGENT']),
    notifications: Boolean(flags['NOTIFICATION']),
    byokRequired: Boolean(health?.byokRequired),
    messaging: Boolean(flags['MESSAGING']),
  };

  const sections = getProfileSections(profileFlags);

  return (
    <Container variant="dataTable" border={false}>
      <PageHeader
        title={<LangLabel text="title" langJson="profile" />}
        description={<LangLabel text="description" langJson="profile" />}
      />
      <SubNavLayout sections={sections} defaultTab="profile">
        <ProfileTabsContent flags={profileFlags} />
      </SubNavLayout>
    </Container>
  );
}
