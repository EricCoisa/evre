'use client';

import { useTranslation } from '@/hooks/use-translation';
import { useActivitiesByStage, useProject, useProjects, useStagesByProject } from '@/lib/actions/project/queries';
import { useProposals } from '@/lib/actions/proposal/queries';
import { useContractDocuments } from '@/lib/actions/contract-document/queries';
import { Container } from '@/components/container';
import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Project } from './components/project';

export default function CompanyDashboardPage() {

  const { data: projectList } = useProjects({ pagination: false });
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  const handleProjectChange = (value: string) => {
    setSelectedProjectId(value);
  };

  return (
    <Container>
      <Select value={selectedProjectId} onValueChange={handleProjectChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue>
            <Badge variant="outline">{selectedProjectId}</Badge>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {(Array.isArray(projectList) ? projectList : projectList?.data)?.map((project) => (
            <SelectItem key={project.id} value={project.id}>
              <Badge variant="outline">{project.name}</Badge>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Project projectId={selectedProjectId} />
    
    </Container>
  );
}
