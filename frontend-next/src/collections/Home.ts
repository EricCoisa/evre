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

            // Seções dinâmicas e agnósticas (Configurador)
            {
              name: 'sections',
              type: 'blocks',
              label: 'Seções da Landing Page',
              labels: {
                singular: 'Seção',
                plural: 'Seções',
              },
              blocks: [
                {
                  slug: 'showcase',
                  labels: {
                    singular: 'Vitrine (Showcase com Demos)',
                    plural: 'Vitrines (Showcases com Demos)',
                  },
                  fields: [
                    {
                      name: 'anchorId',
                      type: 'text',
                      label: 'ID da Âncora (ex: sites, sistemas)',
                      required: true,
                    },
                    {
                      name: 'navLabel',
                      type: 'text',
                      label: 'Texto no Menu / Navbar (opcional, ex: Sites)',
                    },
                    {
                      name: 'label',
                      type: 'text',
                      label: 'Label da seção (ex: Sites & Landing Pages)',
                      required: true,
                    },
                    {
                      name: 'title',
                      type: 'textarea',
                      label: 'Título (use Enter para quebrar linha)',
                      required: true,
                    },
                    {
                      name: 'description',
                      type: 'textarea',
                      label: 'Descrição',
                      required: true,
                    },
                    {
                      name: 'mediaPosition',
                      type: 'select',
                      label: 'Posição do Mockup/Demonstração',
                      defaultValue: 'right',
                      options: [
                        { label: 'Direita (Texto à esquerda, Mockup à direita)', value: 'right' },
                        { label: 'Esquerda (Mockup à esquerda, Texto à direita)', value: 'left' },
                      ],
                    },
                    {
                      name: 'demos',
                      type: 'array',
                      label: 'Demos (artefatos)',
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
                  ],
                },
                {
                  slug: 'cardsGrid',
                  labels: {
                    singular: 'Grid de Cards',
                    plural: 'Grids de Cards',
                  },
                  fields: [
                    {
                      name: 'anchorId',
                      type: 'text',
                      label: 'ID da Âncora (ex: equipes)',
                      required: true,
                    },
                    {
                      name: 'navLabel',
                      type: 'text',
                      label: 'Texto no Menu / Navbar (opcional, ex: Equipes)',
                    },
                    {
                      name: 'label',
                      type: 'text',
                      label: 'Label da seção (ex: Parceria em desenvolvimento)',
                      required: true,
                    },
                    {
                      name: 'title',
                      type: 'textarea',
                      label: 'Título da seção',
                      required: true,
                    },
                    {
                      name: 'description',
                      type: 'textarea',
                      label: 'Descrição da seção',
                      required: true,
                    },
                    {
                      name: 'cards',
                      type: 'array',
                      label: 'Cards',
                      fields: [
                        { name: 'title', type: 'textarea', label: 'Título' },
                        { name: 'description', type: 'textarea', label: 'Descrição' },
                      ],
                    },
                  ],
                },
              ],
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

            // Contact form section
            {
              name: 'contactFormLabel',
              type: 'text',
              label: 'Formulário — Label da âncora',
              defaultValue: 'Entre em contato',
            },
            {
              name: 'contactFormTitle',
              type: 'textarea',
              label: 'Formulário — Título (use Enter para quebrar linha)',
              defaultValue: 'Vamos conversar.',
            },
            {
              name: 'contactFormDescription',
              type: 'textarea',
              label: 'Formulário — Subtítulo',
              defaultValue: 'Responderemos em breve.',
            },
            {
              name: 'contactFormButtonText',
              type: 'text',
              label: 'Formulário — Texto do botão',
              defaultValue: 'Enviar',
            },
            {
              name: 'contactFormSuccessMessage',
              type: 'text',
              label: 'Formulário — Mensagem de sucesso',
              defaultValue: 'Mensagem enviada! Entraremos em contato em breve.',
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
