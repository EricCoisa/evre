import { useTranslation as useTranslationI18n } from 'next-i18next';
import { isLabelKey, applyParams } from '../lib/translation-utils';

export const useTranslation = (namespace = "common") => {
	// Hook simplificado usando next-intl
	const tRaw = useTranslationI18n(namespace);

	// Mantém API compatível: t(key, params?)
	const t = (key: string, params?: Record<string, string | number>) => {
		// Se for labelKey, usa namespace labelKey
		if (isLabelKey(key) && tRaw.i18n.hasResourceBundle(tRaw.i18n.language, 'labelKey')) {
			const base = tRaw.i18n.getResource(tRaw.i18n.language, 'labelKey', key) ?? key;
			return applyParams(base, params);
		}
		// Normal
		return applyParams(tRaw.t(key), params);
	};

	return { t, locale: tRaw.i18n.language, setLocale: undefined };


};
