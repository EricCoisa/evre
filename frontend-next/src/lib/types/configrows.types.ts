import { USER_CONFIG_KEYS } from '@/types/user-config-keys';
import { SYSTEM_CONFIG_KEYS } from '@/types/system-config-keys';

export interface ConfigRowEntry {
  /** Chave de SystemConfiguration/UserConfiguration — dobra como id do DOM setado pelo ConfigRow
   *  e como chave de tradução (`isLabelKey` roteia ALL_CAPS pro bundle `labelKey`, mesmo mecanismo
   *  que `Route.labelKey` já usa — ver locales/{en,pt-BR}/labelKey.json). Sem título próprio aqui:
   *  o texto exibido é sempre `t(id)`. */
  id: string;
  path: string;
  tab: string;
}

/** Registro manual de linhas de configuração com labelKey fixo; não cobre linhas sem labelKey estável. */
export const ConfigRowsList: ConfigRowEntry[] = [
  { id: SYSTEM_CONFIG_KEYS.captchaEnabled, path: '/settings', tab: 'captchaConfig' },
  { id: SYSTEM_CONFIG_KEYS.notificationEmailEnabled, path: '/settings', tab: 'notificationConfig' },
  { id: SYSTEM_CONFIG_KEYS.notificationWhatsappEnabled, path: '/settings', tab: 'notificationConfig' },
  { id: SYSTEM_CONFIG_KEYS.logMinLevel, path: '/settings', tab: 'systemConfig' },
  { id: SYSTEM_CONFIG_KEYS.logLimite, path: '/settings', tab: 'systemConfig' },
  { id: SYSTEM_CONFIG_KEYS.logDeleteDay, path: '/settings', tab: 'systemConfig' },
  { id: SYSTEM_CONFIG_KEYS.theme, path: '/settings', tab: 'userConfig' },
  { id: USER_CONFIG_KEYS.language, path: '/settings', tab: 'userConfig' },
  { id: SYSTEM_CONFIG_KEYS.userCreate, path: '/settings', tab: 'userConfig' },
  { id: SYSTEM_CONFIG_KEYS.aiSystemPrompt, path: '/settings', tab: 'agenteConfig' },
  { id: SYSTEM_CONFIG_KEYS.agentOwnKey, path: '/settings', tab: 'agenteConfig' },
  { id: SYSTEM_CONFIG_KEYS.timeTrackingForgottenThresholdHours, path: '/settings', tab: 'timeTrackingConfig' },
  { id: USER_CONFIG_KEYS.notificationChannelEmail, path: '/profile', tab: 'notifications' },
  { id: USER_CONFIG_KEYS.notificationChannelWhatsapp, path: '/profile', tab: 'notifications' },
];
