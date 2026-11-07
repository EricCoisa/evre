import ProjectDetailPage from '../page';

export default async function ProjectTaskDetailPage({
  params,
}: {
  params: Promise<{ id: string; taskId: string }>;
}) {
  return <ProjectDetailPage params={params} />;
}
