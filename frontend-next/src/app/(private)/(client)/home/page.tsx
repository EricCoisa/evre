'use client';

import { useTranslation } from '@/hooks/use-translation';
import { useMe } from '@/lib/actions/auth/queries';
import { useProjects } from '@/lib/actions/project/queries';
import { Container } from '@/components/container';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Building2,
  FolderKanban,
  ArrowRight,
  Layers,
  CheckSquare,
} from 'lucide-react';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  ACTIVE: 'default',
  COMPLETED: 'outline',
  ARCHIVED: 'secondary',
};

export default function HomePage() {
  const { t } = useTranslation('home');
  const { data: profile } = useMe();
  const { data: projectsData, isLoading: projectsLoading } = useProjects({
    limit: 50,
    pagination: false,
  });

  const projects = Array.isArray(projectsData) ? projectsData : projectsData?.data ?? [];

  const companies = new Map<string, { id: string; name: string }>();
  for (const p of projects) {
    if (p.companyId && p.company?.name && !companies.has(p.companyId)) {
      companies.set(p.companyId, { id: p.companyId, name: p.company.name });
    }
  }
  const companyList = [...companies.values()];

  const greeting = profile?.name
    ? t('greeting', { name: profile.name })
    : t('greetingFallback');

  return (
    <Container border={false}>
      <div className="space-y-8">
        <div className="space-y-1 py-4">
          <h1 className="text-3xl font-bold tracking-tight">{greeting}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>

        {companyList.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              {t('myCompany')}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {companyList.map((company) => {
                const companyProjects = projects.filter(
                  (p) => p.companyId === company.id,
                );
                return (
                  <Card key={company.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">
                        {company.name}
                      </CardTitle>
                      <CardDescription>
                        {companyProjects.length}{' '}
                        {companyProjects.length === 1
                          ? t('project')
                          : t('projects')}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <FolderKanban className="h-5 w-5 text-muted-foreground" />
              {t('myProjects')}
            </h2>
            {projects.length > 0 && (
              <Button variant="ghost" size="sm" asChild>
                <Link href="/my-project">
                  {t('viewAll')} <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>

          {projectsLoading && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-[140px] rounded-lg" />
              ))}
            </div>
          )}

          {!projectsLoading && projects.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <FolderKanban className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
                <p className="text-sm font-medium">{t('noProjects')}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('noProjectsHint')}
                </p>
              </CardContent>
            </Card>
          )}

          {!projectsLoading && projects.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/my-project/${project.id}`}
                  className="group"
                >
                  <Card className="h-full transition-colors group-hover:border-primary/50">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base line-clamp-1">
                          {project.name}
                        </CardTitle>
                        <Badge
                          variant={
                            STATUS_VARIANT[project.status] ?? 'default'
                          }
                          className="flex-shrink-0"
                        >
                          {t(project.status.toLowerCase())}
                        </Badge>
                      </div>
                      {project.company?.name && (
                        <CardDescription className="text-xs">
                          {project.company.name}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="pt-0">
                      {project.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                          {project.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {project._count?.milestones != null && (
                          <span className="flex items-center gap-1">
                            <Layers className="h-3 w-3" />
                            {project._count.milestones} {t('milestones')}
                          </span>
                        )}
                        {project._count?.tasks != null && (
                          <span className="flex items-center gap-1">
                            <CheckSquare className="h-3 w-3" />
                            {project._count.tasks} {t('tasks')}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </Container>
  );
}
