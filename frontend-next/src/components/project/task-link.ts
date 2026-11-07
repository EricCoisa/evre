import { toast } from 'sonner';

/**
 * Retorna o caminho canônico da tarefa no projeto.
 */
export function getTaskPath(projectId: string, taskId: string): string {
  return `/project/${projectId}/${taskId}`;
}

/**
 * Copia a URL canônica da tarefa para a área de transferência.
 */
export async function copyTaskLink(projectId: string, taskId: string): Promise<boolean> {
  const path = getTaskPath(projectId, taskId);
  const fullUrl = `${window.location.origin}${path}`;

  try {
    await navigator.clipboard.writeText(fullUrl);
    toast.success('Link da tarefa copiado!');
    return true;
  } catch {
    toast.error('Erro ao copiar link');
    return false;
  }
}
