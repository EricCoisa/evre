import { isLabelKey, applyParams, resources } from '../lib/translation-utils';
import i18next from 'i18next';
import nextI18NextConfig from '../../next-i18next.config.js';


let i18nInstance: typeof i18next | null = null;

export async function getServerTranslation(locale: keyof typeof resources, namespace: keyof typeof resources["pt-BR"] = "common") {
	if (!i18nInstance) {
		i18nInstance = i18next.createInstance();
		await i18nInstance.init({
			resources,
			lng: locale,
			fallbackLng: nextI18NextConfig.i18n.defaultLocale,
			ns: [namespace, 'labelKey'],
			interpolation: { escapeValue: false },
		});
	} else {
		await i18nInstance.changeLanguage(locale);
	}
	// handle para tradução
	const t = (key: string, params?: Record<string, string | number>) => {
		// Se for labelKey, usa namespace labelKey
		if (isLabelKey(key)) {
			const base = resources[locale].labelKey[key as keyof typeof resources[typeof locale]['labelKey']] ?? key;
			return applyParams(base, params);
		}
		// Normal
		const base = resources[locale][namespace][key as keyof typeof resources[typeof locale][typeof namespace]] ?? key;
		return applyParams(base, params);
	};
	return {
		t,
		locale: i18nInstance.language,
	};
}
