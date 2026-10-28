import { CollectionConfig } from 'payload'
import { PreviewField, MetaTitleField, MetaImageField, MetaDescriptionField, OverviewField } from '@payloadcms/plugin-seo/fields'

export const Home: CollectionConfig = {
  slug: 'home',
  admin: {
    useAsTitle: 'title',
    preview: () => process.env.NEXTAUTH_URL || 'http://localhost:3000',
    livePreview: {
      url: () => `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}?preview=true`,
    },
  },
  access: {
    read: () => true, // leitura pública
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Conteudo',
          fields: [
            {
              name: 'title',
              type: 'text',
              label: 'Page Title',
              required: true,
              defaultValue: 'Home',
            },
            // Hero Section
            {
              name: 'heroTitle',
              type: 'text',
              label: 'Hero Title',
              required: true,
            },
            {
              name: 'heroDescription',
              type: 'textarea',
              label: 'Hero Description',
              required: true,
            },
            {
              name: 'heroPrimaryButtonText',
              type: 'text',
              label: 'Hero Primary Button Text',
              required: true,
            },
            {
              name: 'heroSecondaryButtonText',
              type: 'text',
              label: 'Hero Secondary Button Text',
              required: true,
            },
            {
              name: 'heroWhatsappNumber',
              type: 'text',
              label: 'Hero WhatsApp Number (ex: 5534999999999)',
              required: true,
              defaultValue: '5534999999999',
            },

            // Services Section
            {
              name: 'servicesTitle',
              type: 'text',
              label: 'Services Section Title',
              required: true,
            },
            {
              name: 'servicesDescription',
              type: 'textarea',
              label: 'Services Section Description',
              required: true,
            },
            {
              name: 'services',
              type: 'array',
              label: 'Services Items',
              required: true,
              minRows: 1,
              fields: [
                {
                  name: 'iconName',
                  type: 'select',
                  label: 'Icon',
                  required: true,
                  defaultValue: 'layout-grid',
                  options: [
                    { label: 'Layout / Painel (layout-grid)', value: 'layout-grid' },
                    { label: 'Camadas / SaaS (layers)', value: 'layers' },
                    { label: 'Banco de Dados / Integrações (database)', value: 'database' },
                    { label: 'Mobile / Celular (smartphone)', value: 'smartphone' },
                  ],
                },
                {
                  name: 'title',
                  type: 'text',
                  label: 'Service Title',
                  required: true,
                },
                {
                  name: 'description',
                  type: 'textarea',
                  label: 'Service Description',
                  required: true,
                },
              ],
            },

            // Process Section
            {
              name: 'processTitle',
              type: 'text',
              label: 'Process Section Title',
              required: true,
            },
            {
              name: 'processDescription',
              type: 'textarea',
              label: 'Process Section Description',
              required: true,
            },
            {
              name: 'processSteps',
              type: 'array',
              label: 'Process Steps',
              required: true,
              minRows: 1,
              fields: [
                {
                  name: 'stepNumber',
                  type: 'text',
                  label: 'Step Number (ex: 01)',
                  required: true,
                },
                {
                  name: 'symbol',
                  type: 'select',
                  label: 'Brand Symbol',
                  required: true,
                  options: [
                    { label: '< (Abertura / Planejamento)', value: '<' },
                    { label: '/ (Barra / Desenvolvimento)', value: '/' },
                    { label: '> (Fechamento / Entrega)', value: '>' },
                  ],
                },
                {
                  name: 'title',
                  type: 'text',
                  label: 'Step Title',
                  required: true,
                },
                {
                  name: 'description',
                  type: 'textarea',
                  label: 'Step Description',
                  required: true,
                },
              ],
            },

            // CTA Section
            {
              name: 'ctaTitle',
              type: 'text',
              label: 'CTA Title',
              required: true,
            },
            {
              name: 'ctaDescription',
              type: 'textarea',
              label: 'CTA Description',
              required: true,
            },
            {
              name: 'ctaWhatsappButtonText',
              type: 'text',
              label: 'CTA WhatsApp Button Text',
              required: true,
            },
            {
              name: 'contactEmail',
              type: 'text',
              label: 'Contact Email',
              required: true,
              defaultValue: 'contato@evre.com.br',
            },

            // Footer
            {
              name: 'footerText',
              type: 'text',
              label: 'Footer Text',
              required: true,
              defaultValue: 'EVRE Software House',
            },
          ],
        },
        {
          label: 'SEO',
          name: 'meta',
          fields: [
            MetaTitleField({
              hasGenerateFn: true,
            }),
            MetaDescriptionField({
              hasGenerateFn: true,
            }),
            {
              name: 'cannonicalUrl',
              type: 'text',
              label: 'Canonical URL',
              hooks: {
                beforeChange: [
                  async ({ value }) => (value ? value : `${process.env.NEXTAUTH_URL}/`),
                ],
              },
            },
            MetaImageField({
              relationTo: 'media',
            }),
            PreviewField({
              hasGenerateFn: true,
            }),
            OverviewField({
              titlePath: 'meta.title',
              descriptionPath: 'meta.description',
              imagePath: 'meta.image',
            }),
          ],
        },
      ],
    },
  ],
}
