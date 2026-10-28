import path from 'path'
import type { NextConfig } from "next";
import { withPayload } from '@payloadcms/next/withPayload'

const nextConfig: NextConfig = {
  // Turbopack root must be the monorepo root so pnpm symlinks
  // (frontend-next/node_modules/next → ../../node_modules/.pnpm/...)
  // stay within the allowed boundary and are followed by Turbopack.
  turbopack: {
    root: path.resolve(__dirname, '..'),
  },

  // Performance optimizations
  experimental: {
    optimizePackageImports: ['@tanstack/react-query', 'lucide-react'],
  },

  // typedRoutes: true — desativado porque redirect/page.tsx usa home?.path (string dinâmica
  // vinda da API) que não é atribuível ao RouteImpl<string>. Habilitar quando rotas dinâmicas
  // forem tipadas com `as Route` ou substituídas por rotas estáticas.
  typedRoutes: false,

  // Compiler optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // Images optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 31536000, // 1 year
    remotePatterns: [
      {
        // S3 local (RustFS)
        protocol: 'http',
        hostname: 'localhost',
        port: '8333',
        pathname: '/**',
      },
      {
        // LOCAL provider — backend serves /uploads on its own port
        protocol: 'http',
        hostname: 'localhost',
        port: '3001',
        pathname: '/uploads/**',
      },
      {
        // LOCAL provider (HTTPS / custom host configured via SYSTEM_STORAGE_PUBLIC_BASE_URL)
        protocol: 'https',
        hostname: '**',
        pathname: '/uploads/**',
      },
    ],
  },

  // Output optimization
  output: 'standalone',

  // Headers for caching
  //
  // NÃO acrescente uma regra para `/_next/static/:path*`: o Next já serve esses arquivos
  // com `immutable` em produção (os nomes são hasheados por conteúdo), e `headers()` vale
  // TAMBÉM em dev — onde mandar o browser guardar chunk por um ano quebra o HMR. O sintoma
  // é "module factory is not available ... often caused by a stale browser cache". O próprio
  // build avisa: "Custom Cache-Control headers detected ... can break Next.js development".
  async headers() {
    return [
      // Só o proxy público, e é de propósito.
      //
      // A regra aqui era `/api/:path*`, o que carimbava `public` em 15 rotas
      // AUTENTICADAS — login, refresh, logout, a API REST do Payload, as do agente —
      // para atender esta única que é pública de verdade. `public` autoriza qualquer
      // intermediário (CDN, proxy corporativo, cache do provedor) a guardar a resposta
      // e reservi-la a outra pessoa: com um cache compartilhado na frente, a sessão de
      // um usuário podia ser devolvida para outro.
      //
      // As demais rotas ficam sem header nenhum — que é o padrão do Next para rota
      // dinâmica: não cacheia. Antes de incluir outra aqui, confirme que a resposta não
      // depende de quem pediu. Esta passa: allowlist fixa, sem token, sem dado de usuário.
      {
        source: '/api/public-proxy',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=60, stale-while-revalidate=300',
          },
        ],
      },
    ];
  },
};

export default withPayload(nextConfig);
