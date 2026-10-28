export interface TabEntry {
  path: string;
  tab: string;
  labelKey: string;
  labelNs: string;
  /** Feature flag que precisa estar ligada pra essa aba existir; ausente = sempre visível. */
  flag?: string;
}

/** Registro manual de abas por página (SubNavLayout); exclui a aba `agenteConfig` do perfil. */
export const TabsList: TabEntry[] = [
  { path: '/access', tab: 'userRole', labelKey: 'userTab', labelNs: 'access' },
  { path: '/access', tab: 'routes', labelKey: 'routesTab', labelNs: 'access' },
  { path: '/access', tab: 'main', labelKey: 'mainTab', labelNs: 'access' },

  { path: '/user', tab: 'users', labelKey: 'tabUsers', labelNs: 'users' },
  { path: '/user', tab: 'invites', labelKey: 'tabInvites', labelNs: 'users' },

  { path: '/comunicacao/templates', tab: 'templates', labelKey: 'templatesTab', labelNs: 'messaging', flag: 'MESSAGING_TEMPLATES' },
  { path: '/comunicacao/templates', tab: 'types', labelKey: 'templateTypesTab', labelNs: 'messaging', flag: 'MESSAGING_TEMPLATES' },

  { path: '/settings', tab: 'systemConfig', labelKey: 'systemConfiguration', labelNs: 'settings' },
  { path: '/settings', tab: 'userConfig', labelKey: 'userConfiguration', labelNs: 'settings' },
  { path: '/settings', tab: 'notificationConfig', labelKey: 'notificationConfiguration', labelNs: 'settings', flag: 'NOTIFICATION' },
  { path: '/settings', tab: 'emailConfig', labelKey: 'emailConfiguration', labelNs: 'settings' },
  { path: '/settings', tab: 'storageConfig', labelKey: 'storageConfiguration', labelNs: 'settings' },
  { path: '/settings', tab: 'captchaConfig', labelKey: 'captchaConfiguration', labelNs: 'settings' },
  { path: '/settings', tab: 'oauthConfig', labelKey: 'oauthConfiguration', labelNs: 'settings', flag: 'OAUTH_LOGIN' },
  { path: '/settings', tab: 'agenteConfig', labelKey: 'agentConfiguration', labelNs: 'settings', flag: 'AI_AGENT' },
  { path: '/settings', tab: 'messagingConfig', labelKey: 'messagingConfiguration', labelNs: 'settings', flag: 'MESSAGING' },

  { path: '/profile', tab: 'profile', labelKey: 'tab_profile', labelNs: 'profile' },
  { path: '/profile', tab: 'security', labelKey: 'tab_security', labelNs: 'profile' },
  { path: '/profile', tab: 'preferences', labelKey: 'tab_preferences', labelNs: 'profile' },
  { path: '/profile', tab: 'notifications', labelKey: 'tab_notifications', labelNs: 'profile', flag: 'NOTIFICATION' },
  { path: '/profile', tab: 'account', labelKey: 'tab_account', labelNs: 'profile' },
  { path: '/profile', tab: 'apiKeys', labelKey: 'tab_apiKeys', labelNs: 'profile', flag: 'MCP_API_KEYS' },
  { path: '/profile', tab: 'connectors', labelKey: 'tab_connectors', labelNs: 'profile', flag: 'MCP_CONNECTORS' },
  { path: '/profile', tab: 'agentPermissions', labelKey: 'tab_agentPermissions', labelNs: 'profile', flag: 'AI_AGENT' },
];
