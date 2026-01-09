'use client';

import { Project } from '@/lib/actions/project/types';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import LangLabel from '@/components/ui/langLabel';
import { DetailsTab } from './tabs/details-tab';
import { StagesTab } from './tabs/stages-tab';
import { ProposalsTab } from './tabs/proposals-tab';
import { HistoryTab } from './tabs/history-tab';


interface ProjectDetailProps {
  project: Project;
  isAdmin?: boolean;
}

export function ProjectDetail({ project, isAdmin = false }: ProjectDetailProps) {
  return (
    <Tabs defaultValue="details" className="space-y-6">
      <TabsList>
        <TabsTrigger value="details">
          <LangLabel text="detailsAndComments" langJson="projects" />
        </TabsTrigger>
        <TabsTrigger value="stages">
          <LangLabel text="stagesAndApprovals" langJson="projects" />
        </TabsTrigger>
        <TabsTrigger value="proposals">
          <LangLabel text="proposals" langJson="projects" />
        </TabsTrigger>
        <TabsTrigger value="history">
          <LangLabel text="history" langJson="projects" />
        </TabsTrigger>
      </TabsList>

      <TabsContent value="details">
        <DetailsTab project={project} isAdmin={isAdmin} />
      </TabsContent>

      <TabsContent value="stages">
        <StagesTab project={project} isAdmin={isAdmin} />
      </TabsContent>

      <TabsContent value="proposals">
        <ProposalsTab project={project} />
      </TabsContent>

      <TabsContent value="history">
        <HistoryTab project={project} />
      </TabsContent>
    </Tabs>
  );
}
