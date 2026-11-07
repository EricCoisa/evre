import { redirect } from 'next/navigation';

export default async function MyProjectTaskDetailRedirectPage({
  params,
}: {
  params: Promise<{ id: string; taskId: string }>;
}) {
  const { id, taskId } = await params;
  redirect(`/project/${id}/${taskId}`);
}
