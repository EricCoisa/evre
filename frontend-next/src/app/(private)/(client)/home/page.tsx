'use client';

import { useRouter } from 'next/navigation';
import { useProjects } from '@/lib/actions/project/queries';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Container } from '@/components/container';
import { Loader2, Folder, Calendar } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ProjectStatusColors } from '@/lib/actions/project/types';
import { StateMaster } from '@/components/state-master';

export default function ProjectsOverviewPage() {
    const { t } = useTranslation('home');
    const router = useRouter();
    const { data, isLoading, error } = useProjects({ pagination: false });

    if (error) {
        return (
            <Container>
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="text-center">
                        <p className="text-destructive">{t('errorLoading')}</p>
                    </div>
                </div>
            </Container>
        );
    }

    const projects = Array.isArray(data) ? data : [];

    return (
        <Container>
            <StateMaster
                queryKey={['projects']}
                isLoading={isLoading}
                loadingMessage={t('loading')}
                useTableSkeleton={true}
            >

            <div className="space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{t('projects')}</h1>
                    <p className="text-muted-foreground mt-2">
                        {t('projectsDescription') || 'Visualize todos os seus projetos'}
                    </p>
                </div>

                {/* Projects Grid */}
                {projects && (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {projects.map((project) => (
                            <Card
                                key={project.id}
                                className="cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
                                onClick={() => router.push(`/home/${project.id}`)}
                            >
                                <CardHeader>
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-2">
                                            <Folder className="h-5 w-5 text-primary" />
                                            <CardTitle className="text-lg line-clamp-1">
                                                {project.name}
                                            </CardTitle>
                                        </div>
                                        <Badge
                                            variant="secondary"
                                            className={ProjectStatusColors[project.status as keyof typeof ProjectStatusColors] || ''}
                                        >
                                            {project.status}
                                        </Badge>
                                    </div>
                                    {project.description && (
                                        <CardDescription className="line-clamp-2 mt-2">
                                            {project.description}
                                        </CardDescription>
                                    )}
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2 text-sm text-muted-foreground">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="h-4 w-4" />
                                            <span>
                                                {new Date(project.createdAt).toLocaleDateString('pt-BR')}
                                            </span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
            </StateMaster>
        </Container>
    );
}
