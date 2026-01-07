/**
 * Configurações globais de performance para o projeto
 */

// React Query Configurations
export const QUERY_CONFIG = {
  // Tempos de cache por tipo de dado
  CACHE_TIMES: {
    USER_PROFILE: 10 * 60 * 1000,      // 10 minutos - perfil do usuário
    ROUTES: 10 * 60 * 1000,            // 10 minutos - rotas (raramente mudam)
    USERS: 5 * 60 * 1000,              // 5 minutos - lista de usuários
    USER_ROUTE_ACCESS: 5 * 60 * 1000,  // 5 minutos - acessos de usuário
    LOGGING: 2 * 60 * 1000,            // 2 minutos - logs (mudam frequentemente)
    USER: 10 * 60 * 1000,              // 5 minutos - usuário
    ME: 10 * 60 * 1000,                // 5 minutos - usuário
    COMPANIES: 5 * 60 * 1000,          // 5 minutos - lista de empresas
    COMPANY: 10 * 60 * 1000,           // 10 minutos - empresa individual
  },
  
  // Garbage Collection Times (tempo que dados ficam no cache após stale)
  GC_TIMES: {
    DEFAULT: 10 * 60 * 1000,           // 10 minutos padrão
    USER_PROFILE: 15 * 60 * 1000,      // 15 minutos - perfil é mais estático
    ROUTES: 20 * 60 * 1000,            // 20 minutos - rotas mudam raramente
    LOGGING: 5 * 60 * 1000,            // 5 minutos - logs podem ser removidos rapidamente
    USER: 15 * 60 * 1000,              // 15 minutos - usuário
    ME: 15 * 60 * 1000,                // 15 minutos - usuário
    COMPANIES: 10 * 60 * 1000,         // 10 minutos - lista de empresas
    COMPANY: 15 * 60 * 1000,           // 15 minutos - empresa individual
  },
  
  // Configurações de retry
  RETRY: {
    DEFAULT_COUNT: 2,
    AUTH_ERRORS_COUNT: 0, // Não retry em erros de autenticação
    RETRY_DELAY: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
  },
} as const;

// Next.js Configurations
export const NEXT_CONFIG = {
  // Prefetch configurações
  PREFETCH: {
    ENABLED: true,
    VIEWPORT: true, // Prefetch quando link entra na viewport
  },
  
  // Cache Headers
  CACHE_HEADERS: {
    STATIC_ASSETS: 'public, max-age=31536000, immutable', // 1 ano para assets estáticos
    API_ROUTES: 'public, max-age=60, stale-while-revalidate=300', // 1 minuto com revalidation
    PAGES: 'public, max-age=300, stale-while-revalidate=600', // 5 minutos com revalidation
  },
} as const;

// Performance Monitoring
export const PERFORMANCE_CONFIG = {
  // Web Vitals targets
  TARGETS: {
    LCP: 2500,  // Largest Contentful Paint < 2.5s
    FID: 100,   // First Input Delay < 100ms
    CLS: 0.1,   // Cumulative Layout Shift < 0.1
  },
  
  // Bundle size limits
  BUNDLE_LIMITS: {
    MAIN_BUNDLE: 250 * 1024,      // 250KB
    VENDOR_BUNDLE: 500 * 1024,    // 500KB
    CHUNK_SIZE: 100 * 1024,       // 100KB por chunk
  },
} as const;