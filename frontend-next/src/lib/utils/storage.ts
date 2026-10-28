/** Constrói a URL de um arquivo a partir de uma presigned URL. */

export async function getFileUrl(key: string): Promise<string> {
  // Server-side: fetch direto
  if (typeof window === 'undefined') {
    const { getPresignedUrl } = await import('@/lib/actions/storage/api');
    const res = await getPresignedUrl(key);
    return res.data?.url ?? '';
  }

  // Client-side: deve usar o hook usePresignedUrl() em um componente
  throw new Error(
    'getFileUrl() não suportado client-side. Use o hook: usePresignedUrl(key)',
  );
}
