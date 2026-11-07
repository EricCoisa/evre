import { toast } from 'sonner';

/**
 * Retorna o caminho relativo da tarefa no projeto.
 */
export function getTaskPath(projectId: string, taskId: string, isClient = false): string {
  const base = isClient ? '/my-project' : '/project';
  return `${base}/${projectId}/${taskId}`;
}

/**
 * Copia a URL completa da tarefa para a área de transferência.
 */
export async function copyTaskLink(projectId: string, taskId: string, isClient = false): Promise<boolean> {
  const path = getTaskPath(projectId, taskId, isClient);
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

