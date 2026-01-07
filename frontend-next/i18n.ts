import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { default as nextI18NextConfig } from './next-i18next.config.js';

import {  resources } from '@/lib/translation-utils';

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

export default i18n;
