import sharp from 'sharp'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { buildConfig } from 'payload'
import { en } from '@payloadcms/translations/languages/en'
import { pt } from '@payloadcms/translations/languages/pt'
import { Home } from './src/collections/Home'
import { Media } from './src/collections/Media'
import { LegalPages } from './src/collections/legalPages/LegalPages'
import { CookieConsent } from './src/collections/globals/CookieConsent'
import { seedHomeData } from './src/lib/seeds/home-seed'
import { seedLegalPages } from './src/lib/seeds/legal-pages-seed'
import { seoPlugin } from '@payloadcms/plugin-seo'
import { s3Storage } from '@payloadcms/storage-s3'

export default buildConfig({
  editor: lexicalEditor(),

  /** Admin sem autenticação; não infere usuário automaticamente. */
  admin: {
    user: undefined,

    // ✨ Customiza componentes visuais
    components: {
      graphics: {
        Logo: '@/payload-components/CustomLogo',
        Icon: '@/payload-components/CustomIcon',
      },
      // Provider invisível que sincroniza idioma via postMessage (nunca desmonta)
      providers: ['@/payload-components/PayloadLanguageSync'],
    },

    // ✨ Metadata customizada
    meta: {
      titleSuffix: '- Template Base Admin',
    },
  },

  /** Nenhuma collection usa `auth: true`. */
  collections: [Home, Media, LegalPages],

  globals: [CookieConsent],

  /** Idiomas suportados na interface do Admin Panel. */
  i18n: {
    supportedLanguages: { en, pt },
    fallbackLanguage: 'en',
  },

  /** Secret obrigatório mesmo com admin sem autenticação. */
  secret: process.env.PAYLOAD_SECRET || 'DISABLED_AUTH_MODE',

  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL,
      max: 5, // ponytail: 5 frontend replicas × max=5 = 25 connections; raise if replicas scale
    },
    schemaName: 'payload',
  }),


  sharp,

  // ponytail: PAYLOAD_STORAGE_PROVIDER=s3 (default) uses MinIO/AWS/R2 via s3Storage plugin;
  // PAYLOAD_STORAGE_PROVIDER=local falls back to Payload built-in local disk storage.
  plugins: [
    ...(process.env.PAYLOAD_STORAGE_PROVIDER !== 'local'
      ? [
          s3Storage({
            collections: { media: { prefix: process.env.APP_NAME } },
            bucket: process.env.S3_BUCKET ?? 'app-uploads',
            config: {
              endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:8333',
              region: process.env.S3_REGION ?? 'us-east-1',
              credentials: {
                accessKeyId: process.env.S3_ACCESS_KEY ?? 'minioadmin',
                secretAccessKey: process.env.S3_SECRET_KEY ?? 'minioadmin',
              },
              forcePathStyle: true,
            },
          }),
        ]
      : []),
    seoPlugin({
      generateTitle: ({ doc }) => doc.title,
      generateDescription: ({ doc }) => doc.excerpt,
      generateURL: ({ doc, collectionSlug}) => {
        // Home page is at root, not /home/slug
        if (collectionSlug === 'home') {
          return process.env.NEXTAUTH_URL || 'http://localhost:3000'
        }
        return `${process.env.NEXTAUTH_URL}/${collectionSlug}/${doc?.slug}`
      },
    }),
  ],
  /** onInit roda ao inicializar o Payload; usado para seed automático. */
  async onInit(payload) {
    // Executar seed da coleção Home se não existir documento
    try {
      await seedHomeData(payload)
      await seedLegalPages(payload)
      console.log('✅ Seed completed')
    } catch (error) {
      console.error('❌ Erro ao executar seed automático:', error)
    }

    // ✨ Inicialização customizada
    console.log('🚀 Payload CMS initialized with custom theme')
    console.log('📊 Collections:', payload.config.collections.map(c => c.slug))
  },
})
