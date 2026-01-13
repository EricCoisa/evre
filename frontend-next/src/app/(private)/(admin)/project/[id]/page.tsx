import { getProject } from '@/lib/actions/project/api';
import { ProjectDetail } from '../components/project-detail';
import { notFound } from 'next/navigation';

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const response = await getProject(id);
  
  if (!response.data) {
    notFound();
  }

  const project = response.data;

  return (
    <div className="container mx-auto p-8">
      <ProjectDetail project={project} isAdmin={true} />
    </div>
  );
}
