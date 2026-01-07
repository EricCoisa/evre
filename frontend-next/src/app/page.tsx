'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';

export default function Home() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
        <header className="border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center">
              <span className="text-sm font-bold text-white">E</span>
            </div>
            <span className="text-xl font-bold text-foreground">EVRE</span>
          </div>
          <Link href="/login">
              <Button>
              {t('login')}
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex flex-1 flex-col">
        <section className="flex flex-1 items-center justify-center  from-background via-background to-primary/5 px-6 py-24">
          <div className="text-center">
            <div className="mb-8 inline-flex items-center rounded-full bg-primary/10 border border-primary/20 px-6 py-2 text-sm font-medium text-primary">
              ✨ Template Moderno e Seguro
            </div>

            <h1 className="mb-8 text-5xl font-bold tracking-tight text-foreground sm:text-7xl lg:text-8xl ">
              Comece seu projeto com velocidade e qualidade
            </h1>

            <p className="mb-12 text-xl leading-relaxed text-muted-foreground max-w-3xl mx-auto">
              Template profissional com Next.js 15, autenticação JWT segura,
              componentes modernos e as melhores práticas de desenvolvimento.
              Pronto para produção.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/login">
                  <Button size="lg" className="text-base px-8 py-3">
                  Começar Agora
                </Button>
              </Link>
              <Link href="#features">
                <Button size="lg" variant="outline" className="text-base px-8 py-3 border-2">
                  Saiba Mais
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="border-t border-border bg-card/30 backdrop-blur-sm px-6 py-24">
          <div>
            <div className="mb-16 text-center ">
              <h2 className="mb-6 text-4xl font-bold text-foreground tracking-tight">
                Recursos Incluídos
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Tudo que você precisa para começar rapidamente com qualidade profissional
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {/* Feature 1 */}
              <div className="rounded-xl border border-border bg-card p-8">
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 ">
                  <svg
                    className="h-7 w-7 text-primary"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </div>
                <h3 className="mb-3 text-xl font-semibold text-foreground transition-colors duration-200 group-hover:text-primary">
                  Segurança em Primeiro Lugar
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Autenticação JWT com HttpOnly cookies, proteção contra XSS,
                  CSRF, timing attacks e rate limiting.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="group rounded-xl border border-border bg-card p-8 shadow-sm hover:shadow-md transition-all duration-300 hover:border-primary/20">
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 group-hover:bg-primary/20 transition-colors">
                  <svg
                    className="h-7 w-7 text-primary"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                </div>
                <h3 className="mb-3 text-xl font-semibold text-foreground group-hover:text-primary transition-colors">
                  Performance Otimizada
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Next.js 15 com App Router, SSR, componentes React otimizados e
                  cache inteligente para máxima velocidade.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="group rounded-xl border border-border bg-card p-8 shadow-sm hover:shadow-md transition-all duration-300 hover:border-primary/20">
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 group-hover:bg-primary/20 transition-colors">
                  <svg
                    className="h-7 w-7 text-primary"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
                    />
                  </svg>
                </div>
                <h3 className="mb-3 text-xl font-semibold text-foreground group-hover:text-primary transition-colors">
                  Design System Completo
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  shadcn/ui, Tailwind CSS, componentes acessíveis e responsivos
                  prontos para uso profissional.
                </p>
              </div>

              {/* Feature 4 */}
              <div className="rounded-lg border border-border bg-card p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                  <svg
                    className="h-6 w-6 text-primary"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h3 className="mb-2 text-xl font-semibold text-foreground">
                  TypeScript Strict
                </h3>
                <p className="text-muted-foreground">
                  100% tipado com TypeScript, validação com Zod, e ESLint
                  configurado para qualidade de código.
                </p>
              </div>

              {/* Feature 5 */}
              <div className="rounded-lg border border-border bg-card p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                  <svg
                    className="h-6 w-6 text-primary"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
                    />
                  </svg>
                </div>
                <h3 className="mb-2 text-xl font-semibold text-foreground">
                  Backend Integrado
                </h3>
                <p className="text-muted-foreground">
                  API NestJS com PostgreSQL, Prisma ORM, i18n e documentação
                  Swagger automática.
                </p>
              </div>

              {/* Feature 6 */}
              <div className="rounded-lg border border-border bg-card p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                  <svg
                    className="h-6 w-6 text-primary"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
                    />
                  </svg>
                </div>
                <h3 className="mb-2 text-xl font-semibold text-foreground">
                  Pronto para Produção
                </h3>
                <p className="text-muted-foreground">
                  Logging, error handling, health checks, migrations e deploy
                  configurations incluídas.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Tech Stack Section */}
        <section className="border-t border-border bg-muted/30 px-4 py-20">
          <div className="mx-auto max-w-6xl text-center">
            <h2 className="mb-4 text-3xl font-bold text-foreground">
              Stack Tecnológica
            </h2>
            <p className="mb-12 text-muted-foreground">
              Construído com as melhores tecnologias do mercado
            </p>

            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg bg-card p-6 shadow-sm">
                <div className="mb-3 text-4xl">⚛️</div>
                <h3 className="mb-1 font-semibold text-foreground">Next.js 15</h3>
                <p className="text-sm text-muted-foreground">App Router + SSR</p>
              </div>
              <div className="rounded-lg bg-card p-6 shadow-sm">
                <div className="mb-3 text-4xl">🎨</div>
                <h3 className="mb-1 font-semibold text-foreground">
                  Tailwind CSS
                </h3>
                <p className="text-sm text-muted-foreground">Utility-first CSS</p>
              </div>
              <div className="rounded-lg bg-card p-6 shadow-sm">
                <div className="mb-3 text-4xl">🚀</div>
                <h3 className="mb-1 font-semibold text-foreground">NestJS</h3>
                <p className="text-sm text-muted-foreground">Backend Framework</p>
              </div>
              <div className="rounded-lg bg-card p-6 shadow-sm">
                <div className="mb-3 text-4xl">🐘</div>
                <h3 className="mb-1 font-semibold text-foreground">PostgreSQL</h3>
                <p className="text-sm text-muted-foreground">Database + Prisma</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/30">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded bg-linear-to-br from-blue-600 to-cyan-600" />
              <span className="font-semibold text-foreground">Template Base</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} - Template
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
