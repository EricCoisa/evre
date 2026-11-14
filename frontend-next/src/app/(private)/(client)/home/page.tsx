'use client';

import { useTranslation } from '@/hooks/use-translation';
import { useMe } from '@/lib/actions/auth/queries';
import { useProjects } from '@/lib/actions/project/queries';
import type { Project } from '@/lib/actions/project/types';

type HomeProject = Project & {
  company?: { name?: string } | null;
  description?: string | null;
  _count?: { milestones?: number; tasks?: number };
};
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

function resolveProjectsList(data: HomeProject[] | { data?: HomeProject[] } | undefined): HomeProject[] {
  return Array.isArray(data) ? data : data?.data ?? [];
}

function buildCompanyList(projects: HomeProject[]): { id: string; name: string }[] {
  const companies = new Map<string, { id: string; name: string }>();
  for (const p of projects) {
    if (p.companyId && p.company?.name && !companies.has(p.companyId)) {
      companies.set(p.companyId, { id: p.companyId, name: p.company.name });
    }
  }
  return [...companies.values()];
}

function resolveGreeting(name: string | null | undefined, t: (key: string, params?: Record<string, string>) => string): string {
  if (!name) return t('greetingFallback');
  return t('greeting', { name });
}

function CompaniesSection({
  companyList,
  projects,
  t,
}: {
  companyList: { id: string; name: string }[];
  projects: HomeProject[];
  t: (key: string) => string;
}) {
  if (companyList.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Building2 className="h-5 w-5 text-muted-foreground" />
        {t('myCompany')}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {companyList.map((company) => {
          const companyProjects = projects.filter((p) => p.companyId === company.id);
          return (
            <Card key={company.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{company.name}</CardTitle>
                <CardDescription>
                  {companyProjects.length}{' '}
                  {companyProjects.length === 1 ? t('project') : t('projects')}
                </CardDescription>
              </CardHeader>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

function ProjectsSectionHeader({
  hasProjects,
  t,
}: {
  hasProjects: boolean;
  t: (key: string) => string;
}) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <FolderKanban className="h-5 w-5 text-muted-foreground" />
        {t('myProjects')}
      </h2>
      {hasProjects && (
        <Button variant="ghost" size="sm" asChild>
          <Link href="/project">
            {t('viewAll')} <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      )}
    </div>
  );
}

function ProjectsLoadingGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-[140px] rounded-lg" />
      ))}
    </div>
  );
}

function NoProjectsCard({ t }: { t: (key: string) => string }) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <FolderKanban className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
        <p className="text-sm font-medium">{t('noProjects')}</p>
        <p className="text-xs text-muted-foreground mt-1">{t('noProjectsHint')}</p>
      </CardContent>
    </Card>
  );
}

function ProjectCard({ project, t }: { project: HomeProject; t: (key: string) => string }) {
  return (
    <Link href={`/project/${project.id}`} className="group">
      <Card className="h-full transition-colors group-hover:border-primary/50">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base line-clamp-1">{project.name}</CardTitle>
            <Badge variant={STATUS_VARIANT[project.status] ?? 'default'} className="flex-shrink-0">
              {t(project.status.toLowerCase())}
            </Badge>
          </div>
          {project.company?.name && (
            <CardDescription className="text-xs">{project.company.name}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="pt-0">
          {project.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{project.description}</p>
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
  );
}

type ProjectsViewState = 'loading' | 'empty' | 'list';

function resolveProjectsViewState(loading: boolean, hasProjects: boolean): ProjectsViewState {
  if (loading) return 'loading';
  return hasProjects ? 'list' : 'empty';
}

function ProjectsSection({
  loading,
  projects,
  t,
}: {
  loading: boolean;
  projects: HomeProject[];
  t: (key: string) => string;
}) {
  const viewState = resolveProjectsViewState(loading, projects.length > 0);
  return (
    <section className="space-y-3">
      <ProjectsSectionHeader hasProjects={projects.length > 0} t={t} />
      {viewState === 'loading' && <ProjectsLoadingGrid />}
      {viewState === 'empty' && <NoProjectsCard t={t} />}
      {viewState === 'list' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} t={t} />
          ))}
        </div>
      )}
    </section>
  );
}

export default function HomePage() {
  const { t } = useTranslation('home');
  const { data: profile } = useMe();
  const { data: projectsData, isLoading: projectsLoading } = useProjects({
    limit: 50,
    pagination: false,
  });

  const projects = resolveProjectsList(projectsData);
  const companyList = buildCompanyList(projects);
  const greeting = resolveGreeting(profile?.name, t);

  return (
    <Container border={false}>
      <div className="space-y-8">
        <div className="space-y-1 py-4">
          <h1 className="text-3xl font-bold tracking-tight">{greeting}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>

        <CompaniesSection companyList={companyList} projects={projects} t={t} />

        <ProjectsSection loading={projectsLoading} projects={projects} t={t} />
      </div>
    </Container>
  );
}
