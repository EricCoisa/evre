import ClientProjectDetailPage from '../page';

export default async function ClientProjectTaskDetailPage({
  params,
}: {
  params: Promise<{ id: string; taskId: string }>;
}) {
  return <ClientProjectDetailPage params={params} />;
}
