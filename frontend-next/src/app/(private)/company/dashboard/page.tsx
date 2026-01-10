'use client';

import { useTranslation } from '@/hooks/use-translation';
import { useProjects } from '@/lib/actions/project/queries';
import { useProposals } from '@/lib/actions/proposal/queries';
import { useContractDocuments } from '@/lib/actions/contract-document/queries';
import { Container } from '@/components/container';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StateMaster } from '@/components/state-master';
import { Button } from '@/components/ui/button';
import { 
  FolderKanban, 
  FileText, 
  FileCheck, 
  TrendingUp,
  ArrowRight,
  Clock
} from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import type { Project } from '@/lib/actions/project/types';
import type { Proposal } from '@/lib/actions/proposal/types';
import type { ContractDocument } from '@/lib/actions/contract-document/types';

interface KPICardProps {
  title: string;
  value: number;
  description: string;
  icon: React.ReactNode;
  href?: string;
}

function KPICard({ title, value, description, icon, href }: KPICardProps) {
  const content = (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="h-4 w-4 text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

interface RecentProjectCardProps {
  project: Project & { companyName?: string | null };
}

function RecentProjectCard({ project }: RecentProjectCardProps) {
  const { t: tProjects } = useTranslation('projects');
  
  const statusColors: Record<string, string> = {
    PROPOSAL: 'bg-yellow-100 text-yellow-800',
    REQUIREMENTS: 'bg-blue-100 text-blue-800',
    DEVELOPMENT: 'bg-purple-100 text-purple-800',
    DONE: 'bg-green-100 text-green-800',
  };

  return (
    <Link href={`/project/${project.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base">{project.name}</CardTitle>
              {project.description && (
                <CardDescription className="line-clamp-2">
                  {project.description}
                </CardDescription>
              )}
            </div>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[project.status] || 'bg-gray-100 text-gray-800'}`}>
              {tProjects(`status.${project.status}`)}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center text-sm text-muted-foreground">
            <Clock className="mr-1 h-3 w-3" />
            {new Date(project.updatedAt).toLocaleDateString('pt-BR')}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function CompanyDashboardPage() {
  const { t } = useTranslation('dashboard');
  const { t: tProjects } = useTranslation('projects');
  const { t: tProposal } = useTranslation('proposal');
  const { t: tContract } = useTranslation('contractDocument');

  // 🔒 SEGURANÇA: Queries usam o companyId do backend (token JWT)
  // Nunca passamos companyId do frontend
  const projectsQuery = useProjects({ 
    pagination: false,
  });

  const proposalsQuery = useProposals({ 
    pagination: false,
  });

  const contractsQuery = useContractDocuments({ 
    pagination: false,
  });

  // Computar estatísticas dos projetos
  const projectStats = useMemo(() => {
    if (!projectsQuery.data || !Array.isArray(projectsQuery.data)) {
      return {
        total: 0,
        byStatus: {},
        recent: [],
      };
    }

    const projects = projectsQuery.data as (Project & { companyName?: string | null })[];
    
    const byStatus = projects.reduce((acc, project) => {
      acc[project.status] = (acc[project.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Últimos 5 projetos atualizados
    const recent = [...projects]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5);

    return {
      total: projects.length,
      byStatus,
      recent,
    };
  }, [projectsQuery.data]);

  const proposalCount = useMemo(() => {
    if (!proposalsQuery.data || !Array.isArray(proposalsQuery.data)) {
      return 0;
    }
    return (proposalsQuery.data as Proposal[]).length;
  }, [proposalsQuery.data]);

  const contractCount = useMemo(() => {
    if (!contractsQuery.data || !Array.isArray(contractsQuery.data)) {
      return 0;
    }
    return (contractsQuery.data as ContractDocument[]).length;
  }, [contractsQuery.data]);

  const isLoading = projectsQuery.isLoading || proposalsQuery.isLoading || contractsQuery.isLoading;

  return (
    <Container>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('dashboard')}</h1>
          <p className="text-muted-foreground">{t('dashboardDescription')}</p>
        </div>

        {/* KPIs - usando StateMaster apenas para loading/error */}
        <StateMaster
          queryKey={['projects']}
          isLoading={isLoading}
          loadingMessage={tProjects('loading')}
        >
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <KPICard
              title={tProjects('entityPlural')}
              value={projectStats.total}
              description={tProjects('totalProjects') || 'Total de projetos'}
              icon={<FolderKanban className="h-4 w-4" />}
              href="/project"
            />
            
            <KPICard
              title={tProposal('entityPlural')}
              value={proposalCount}
              description={tProposal('totalProposals') || 'Propostas criadas'}
              icon={<FileText className="h-4 w-4" />}
              href="/proposal"
            />
            
            <KPICard
              title={tContract('entityPlural')}
              value={contractCount}
              description={tContract('totalContracts') || 'Contratos ativos'}
              icon={<FileCheck className="h-4 w-4" />}
              href="/contract-document"
            />

            <KPICard
              title={tProjects('inDevelopment') || 'Em Desenvolvimento'}
              value={projectStats.byStatus['DEVELOPMENT'] || 0}
              description={tProjects('activeProjects') || 'Projetos ativos'}
              icon={<TrendingUp className="h-4 w-4" />}
              href="/project?filter=DEVELOPMENT"
            />
          </div>
        </StateMaster>

        {/* Projetos Recentes */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold tracking-tight">
              {tProjects('recentProjects') || 'Projetos Recentes'}
            </h2>
            <Button variant="ghost" asChild>
              <Link href="/project">
                {tProjects('viewAll') || 'Ver todos'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          <StateMaster
            queryKey={['projects']}
            isLoading={projectsQuery.isLoading}
            loadingMessage={tProjects('loading')}
          >
            {projectStats.recent.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  {tProjects('noProjects')}
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {projectStats.recent.map((project) => (
                  <RecentProjectCard key={project.id} project={project} />
                ))}
              </div>
            )}
          </StateMaster>
        </div>

        {/* Links Rápidos */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FolderKanban className="h-4 w-4" />
                {tProjects('entityPlural')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full" asChild>
                <Link href="/project">
                  {tProjects('viewAll') || 'Ver todos'}
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                {tProposal('entityPlural')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full" asChild>
                <Link href="/proposal">
                  {tProposal('viewAll') || 'Ver todos'}
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileCheck className="h-4 w-4" />
                {tContract('entityPlural')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full" asChild>
                <Link href="/contract-document">
                  {tContract('viewAll') || 'Ver todos'}
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </Container>
  );
}
