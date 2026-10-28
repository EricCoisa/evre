import { CollectionConfig } from 'payload'
import labels from './LegalPages.labels.json'

export const LegalPages: CollectionConfig = {
  slug: 'legal-pages',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'published', 'updatedAt'],
    preview: (doc) => `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/legal/${doc.slug as string}?preview=true`,
    livePreview: {
      url: ({ data }) => `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/legal/${data.slug}?preview=true`,
    },
  },
  access: {
    read: ({ req }) => {
      if (req.user) return true
      return { published: { equals: true } }
    },
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      label: labels.title,
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      label: labels.slug,
      required: true,
      unique: true,
      index: true,
      validate: (value: string | string[] | null | undefined) =>
        typeof value === 'string' && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value)
          ? true
          : 'Slug must be lowercase letters, numbers and hyphens only (e.g. privacy-policy)',
    },
    {
      name: 'content',
      type: 'richText',
      label: labels.content,
      required: true,
    },
    {
      name: 'published',
      type: 'checkbox',
      label: labels.published,
      defaultValue: false,
    },
  ],
}
