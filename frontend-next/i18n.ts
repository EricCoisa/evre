import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { z } from 'zod';
import { default as nextI18NextConfig } from './next-i18next.config.cjs';

import {  resources, applyParams } from '@/lib/translation-utils';

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: nextI18NextConfig.i18n.defaultLocale,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    ...nextI18NextConfig,
  });

/** Define o error map global do Zod com mensagens de validação traduzidas para o idioma da sessão. */
const applyZodLocale = (lng: string) => {
  const zodLocale = (lng.startsWith('pt') ? z.locales.pt() : z.locales.en())
    .localeError;

  z.config({
    localeError: (issue) => {
      const text = (key: string, params?: Record<string, number>) =>
        applyParams(i18n.t(key, { ns: 'common' }), params);

      if (issue.code === 'too_small' && issue.origin === 'string') {
        // `.min(1)` é só "não pode ficar vazio" — dizer "mínimo 1 caractere" é pior.
        return Number(issue.minimum) <= 1
          ? text('validation_required')
          : text('validation_min_chars', { count: Number(issue.minimum) });
      }

      if (issue.code === 'too_big' && issue.origin === 'string') {
        return text('validation_max_chars', { count: Number(issue.maximum) });
      }

      return zodLocale?.(issue);
    },
  });
};

applyZodLocale(i18n.language);
i18n.on('languageChanged', applyZodLocale);

export default i18n;
