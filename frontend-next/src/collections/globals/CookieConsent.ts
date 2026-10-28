import { GlobalConfig } from 'payload'
import labels from './CookieConsent.labels.json'

export const CookieConsent: GlobalConfig = {
  slug: 'cookie-consent',
  label: labels.label,
  access: {
    read: () => true,
    update: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      name: 'message',
      type: 'textarea',
      label: labels.message,
      required: true,
      defaultValue:
        'Usamos cookies essenciais para o funcionamento do site. Ao continuar navegando, você concorda com nossa política de privacidade.',
    },
    {
      name: 'acceptButtonText',
      type: 'text',
      label: labels.acceptButtonText,
      required: true,
      defaultValue: 'Aceitar',
    },
    {
      name: 'declineButtonText',
      type: 'text',
      label: labels.declineButtonText,
      required: true,
      defaultValue: 'Recusar',
    },
    {
      name: 'policyLinkSlug',
      type: 'text',
      label: labels.policyLinkSlug,
      defaultValue: 'politica-cookies',
    },
    {
      name: 'policyLinkText',
      type: 'text',
      label: labels.policyLinkText,
      defaultValue: 'Saiba mais',
    },
  ],
}
