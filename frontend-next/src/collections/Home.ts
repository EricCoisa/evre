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
    read: () => true,
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

            // Hero
            {
              name: 'heroTitle',
              type: 'textarea',
              label: 'Hero — Título (use Enter para quebrar linha)',
              required: true,
            },
            {
              name: 'heroDescription',
              type: 'textarea',
              label: 'Hero — Subtítulo',
              required: true,
            },
            {
              name: 'heroCta',
              type: 'text',
              label: 'Hero — Botão CTA',
              required: true,
              defaultValue: 'Falar no WhatsApp',
            },
            {
              name: 'heroWhatsappNumber',
              type: 'text',
              label: 'WhatsApp (ex: 5534953301409)',
              required: true,
              defaultValue: '5534953301409',
            },

            // Sites section
            {
              name: 'sitesLabel',
              type: 'text',
              label: 'Sites — Label da âncora',
              required: true,
              defaultValue: 'Sites & Landing Pages',
            },
            {
              name: 'sitesTitle',
              type: 'textarea',
              label: 'Sites — Título',
              required: true,
            },
            {
              name: 'sitesDescription',
              type: 'textarea',
              label: 'Sites — Descrição',
              required: true,
            },

            {
              name: 'siteDemos',
              type: 'array',
              label: 'Sites — Demos (artefatos)',
              fields: [
                {
                  name: 'url',
                  type: 'text',
                  label: 'URL do artefato (ex: http://localhost:3000/api/artifacts/public/xxx)',
                },
                {
                  name: 'label',
                  type: 'text',
                  label: 'Endereço exibido na barra (ex: casamelo.com.br)',
                },
              ],
            },

            // Sistemas section
            {
              name: 'sistemasLabel',
              type: 'text',
              label: 'Sistemas — Label da âncora',
              required: true,
              defaultValue: 'Sistemas para empresas',
            },
            {
              name: 'sistemasTitle',
              type: 'textarea',
              label: 'Sistemas — Título',
              required: true,
            },
            {
              name: 'sistemasDescription',
              type: 'textarea',
              label: 'Sistemas — Descrição',
              required: true,
            },

            {
              name: 'sistemaDemos',
              type: 'array',
              label: 'Sistemas — Demos (artefatos)',
              fields: [
                {
                  name: 'url',
                  type: 'text',
                  label: 'URL do artefato (ex: http://localhost:3000/api/artifacts/public/xxx)',
                },
                {
                  name: 'label',
                  type: 'text',
                  label: 'Label exibido na barra do frame (ex: CORE Gestão)',
                },
              ],
            },

            // Reforço de equipes section
            {
              name: 'reforcosLabel',
              type: 'text',
              label: 'Equipes — Label da âncora',
              required: true,
              defaultValue: 'Reforço de equipes',
            },
            {
              name: 'reforcosTitle',
              type: 'textarea',
              label: 'Equipes — Título da seção',
              required: true,
            },
            {
              name: 'reforcosDescription',
              type: 'textarea',
              label: 'Equipes — Descrição da seção',
              required: true,
            },
            {
              name: 'equipesCellOneTitle',
              type: 'textarea',
              label: 'Equipes — Célula 1 Título',
              required: true,
            },
            {
              name: 'equipesCellOneDescription',
              type: 'textarea',
              label: 'Equipes — Célula 1 Descrição',
              required: true,
            },
            {
              name: 'equipesCellTwoTitle',
              type: 'textarea',
              label: 'Equipes — Célula 2 Título',
              required: true,
            },
            {
              name: 'equipesCellTwoDescription',
              type: 'textarea',
              label: 'Equipes — Célula 2 Descrição',
              required: true,
            },
            {
              name: 'equipesCellThreeTitle',
              type: 'textarea',
              label: 'Equipes — Célula 3 Título',
              required: true,
            },
            {
              name: 'equipesCellThreeDescription',
              type: 'textarea',
              label: 'Equipes — Célula 3 Descrição',
              required: true,
            },

            // CTA
            {
              name: 'ctaTitle',
              type: 'textarea',
              label: 'CTA — Título (use Enter para quebrar linha)',
              required: true,
            },
            {
              name: 'ctaButtonText',
              type: 'text',
              label: 'CTA — Texto do botão WhatsApp',
              required: true,
              defaultValue: 'Chamar no WhatsApp',
            },
            {
              name: 'contactEmail',
              type: 'text',
              label: 'E-mail de contato',
              required: true,
              defaultValue: 'contato@evre.com.br',
            },

            // Footer
            {
              name: 'footerText',
              type: 'text',
              label: 'Rodapé — Identificação',
              required: true,
              defaultValue: 'EVRE Software House',
            },
          ],
        },
        {
          label: 'SEO',
          name: 'meta',
          fields: [
            MetaTitleField({ hasGenerateFn: true }),
            MetaDescriptionField({ hasGenerateFn: true }),
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
            MetaImageField({ relationTo: 'media' }),
            PreviewField({ hasGenerateFn: true }),
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
