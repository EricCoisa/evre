'use client';

import { useTranslation } from '@/hooks/use-translation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Zap, Layout, RefreshCw, Cookie, Globe } from 'lucide-react';
import { Container } from '@/components/container';

export default function HomePage() {
  const { t } = useTranslation('home');

  const features = [
    { icon: Shield, title: t('authJWT') },
    { icon: Layout, title: t('protectedPage') },
    { icon: Cookie, title: t('httpOnlyCookies') },
    { icon: RefreshCw, title: t('autoRefresh') },
    { icon: Globe, title: t('sharedHeader') },
  ];

  const routes = [
    { path: '/home', description: t('thisPage') },
    { path: '/dashboard', description: t('adminPanel') },
    { path: '/*', description: t('sharedLayout') },
  ];

  return (
    <Container border={false}>
      <div className="space-y-8">
        {/* Hero Section */}
        <div className="text-center space-y-4 py-8">
          <h1 className="text-4xl font-bold tracking-tight">
            {t('title')}
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            {t('description')}
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="col-span-full">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Zap className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">{t('informationTitle')}</CardTitle>
                  <CardDescription className="text-sm">
                    {t('featuresCardDesc')}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {features.map((feature, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border">
                    <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-muted text-muted-foreground">
                      <feature.icon className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-medium text-foreground">{feature.title}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Route Structure */}
         <Card className="col-span-full">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Layout className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">{t('routeStructureTitle')}</CardTitle>
                  <CardDescription className="text-sm">
                    {t('routeStructureDesc')} <code className="text-xs bg-muted px-1.5 py-0.5 rounded">(dashboard)</code>
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {routes.map((route, index) => (
                <div key={index} className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border bg-muted/30">
                  <code className="text-sm bg-card px-2.5 py-1 rounded border border-border font-mono">
                    {route.path}
                  </code>
                  <span className="text-sm text-muted-foreground">-</span>
                  <span className="text-sm text-foreground">{route.description}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </Container>
  );
}
