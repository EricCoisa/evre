'use client';

import { useTranslation } from '@/hooks/use-translation';
import { useProjects } from '@/lib/actions/project/queries';
import { Container } from '@/components/container';
import { PageHeader } from '@/components/page-header';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FolderKanban, Layers, CheckSquare } from 'lucide-react';
import Link from 'next/link';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  ACTIVE: 'default',
  COMPLETED: 'outline',
  ARCHIVED: 'secondary',
};

export default function MyProjectPage() {
  const { t } = useTranslation('home');
  const { data: projectsData, isLoading } = useProjects({
    limit: 100,
    pagination: false,
  });

  const projects: any[] = Array.isArray(projectsData)
    ? projectsData
    : (projectsData as any)?.data ?? [];

  return (
    <Container border={false}>
      <PageHeader
        title={t('myProjects')}
        description={t('subtitle')}
      />

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-[140px] rounded-lg" />
          ))}
        </div>
      )}

      {!isLoading && projects.length === 0 && (
        <Card className="mt-6">
          <CardContent className="py-12 text-center">
            <FolderKanban className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm font-medium">{t('noProjects')}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {t('noProjectsHint')}
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && projects.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-6">
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
                      variant={STATUS_VARIANT[project.status] ?? 'default'}
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
    </Container>
  );
}
