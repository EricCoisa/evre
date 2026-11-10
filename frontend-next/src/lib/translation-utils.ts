import ptBRCommon from '../locales/pt-BR/common.json';
import ptBRAccess from '../locales/pt-BR/access.json';
import ptBRDashboard from '../locales/pt-BR/dashboard.json';
import ptBRHome from '../locales/pt-BR/home.json';
import ptBRLabelKey from '../locales/pt-BR/labelKey.json';
import ptBRLogging from '../locales/pt-BR/logging.json';
import ptBRProfile from '../locales/pt-BR/profile.json';
import ptBRUsers from '../locales/pt-BR/user.json';
import ptBRSettings from '../locales/pt-BR/settings.json';
import ptBRSignup from '../locales/pt-BR/signup.json';
import ptBRforgotPassword from '../locales/pt-BR/forgotPassword.json';
import ptBRresetPassword from '../locales/pt-BR/resetPassword.json';
import ptBRLogin from '../locales/pt-BR/login.json';
import ptBRFeatureFlags from '../locales/pt-BR/feature-flags.json';
import ptBRTour from '../locales/pt-BR/tour.json';
import ptBRAgent from '../locales/pt-BR/agent.json';
import ptBRPageBuilder from '../locales/pt-BR/page-builder.json';
import ptBRMessaging from '../locales/pt-BR/messaging.json';
import ptBRNotification from '../locales/pt-BR/notification.json';
import ptBRVocabulary from '../locales/pt-BR/vocabulary.json';
import enCommon from '../locales/en/common.json';
import enAccess from '../locales/en/access.json';
import enDashboard from '../locales/en/dashboard.json';
import enHome from '../locales/en/home.json';
import enLabelKey from '../locales/en/labelKey.json';
import enLogging from '../locales/en/logging.json';
import enProfile from '../locales/en/profile.json';
import enUsers from '../locales/en/user.json';
import enSettings from '../locales/en/settings.json';
import enSignup from '../locales/en/signup.json';
import enforgotPassword from '../locales/en/forgotPassword.json';
import enresetPassword from '../locales/en/resetPassword.json';
import enLogin from '../locales/en/login.json';
import enFeatureFlags from '../locales/en/feature-flags.json';
import enTour from '../locales/en/tour.json';
import enAgent from '../locales/en/agent.json';
import enPageBuilder from '../locales/en/page-builder.json';
import enMessaging from '../locales/en/messaging.json';
import enNotification from '../locales/en/notification.json';
import enVocabulary from '../locales/en/vocabulary.json';


import ptBRCompany from '../locales/pt-BR/company.json';
import enCompany from '../locales/en/company.json';
import ptBRProposal from '../locales/pt-BR/proposal.json';
import enProposal from '../locales/en/proposal.json';
import ptBRArtifact from '../locales/pt-BR/artifact.json';
import enArtifact from '../locales/en/artifact.json';
import ptBRProject from '../locales/pt-BR/project.json';
import enProject from '../locales/en/project.json';
import ptBRTimeTracking from '../locales/pt-BR/time-tracking.json';
import enTimeTracking from '../locales/en/time-tracking.json';
export const resources = {
	'pt-BR': {
		'time-tracking': ptBRTimeTracking,
		proposal: ptBRProposal,
		company: ptBRCompany,
		artifact: ptBRArtifact,
		project: ptBRProject,
		common: ptBRCommon,
		access: ptBRAccess,
		dashboard: ptBRDashboard,
		home: ptBRHome,
		labelKey: ptBRLabelKey,
		logging: ptBRLogging,
		profile: ptBRProfile,
		users: ptBRUsers,
    settings: ptBRSettings,
    signup: ptBRSignup,
    forgotPassword: ptBRforgotPassword,
    resetPassword: ptBRresetPassword,
    login: ptBRLogin,
    'feature-flags': ptBRFeatureFlags,
    tour: ptBRTour,
    agent: ptBRAgent,
    'page-builder': ptBRPageBuilder,
    messaging: ptBRMessaging,
    notification: ptBRNotification,
    vocabulary: ptBRVocabulary,
	},
	en: {
		'time-tracking': enTimeTracking,
		proposal: enProposal,
		company: enCompany,
		artifact: enArtifact,
		project: enProject,
		common: enCommon,
		access: enAccess,
		dashboard: enDashboard,
		home: enHome,
		labelKey: enLabelKey,
		logging: enLogging,
		profile: enProfile,
		users: enUsers,
    settings: enSettings,
    signup: enSignup,
    forgotPassword: enforgotPassword,
    resetPassword: enresetPassword,
    login: enLogin,
    'feature-flags': enFeatureFlags,
    tour: enTour,
    agent: enAgent,
    'page-builder': enPageBuilder,
    messaging: enMessaging,
    notification: enNotification,
    vocabulary: enVocabulary,
	},
};

export type Translations = Record<string, string>;

export function isLabelKey(key: string): boolean {
  return /^[A-Z_]+$/.test(key);
}

export function applyParams(text: string, params?: Record<string, string | number>): string {
  if (!params) return text;
  let out = text;
  for (const [k, v] of Object.entries(params)) {
    out = out.replace(`{${k}}`, String(v));
  }
  return out;
}

// Carrega tradução de um JSON (server: via import, client: via fetch)
export async function getTranslationFromJson(
  locale: string,
  namespace: string,
  fallbackLocale = process.env.DEFAULT_LOCALE || 'pt-BR',
  fetcher?: (path: string) => Promise<Translations>
): Promise<Translations> {
  // fetcher: client deve passar fetch, server pode usar import
  if (!fetcher) throw new Error("fetcher is required");
  try {
    const data = await fetcher(`/locales/${locale}/${namespace}.json`);
    if (data) return data;
  } catch {}
  // Fallback
  try {
    const fallbackData = await fetcher(`/locales/${fallbackLocale}/${namespace}.json`);
    if (fallbackData) return fallbackData;
  } catch {}
  return {};
}
// --- Tradução Utils ---