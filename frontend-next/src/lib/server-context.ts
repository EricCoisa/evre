import { cache } from 'react';
import { getCurrentUser } from './actions/auth/api';
import { getMyFeatureFlags } from './actions/feature-flag/api';
import { getAiHealth, type AiHealthStatus } from './actions/ai/api';
import { getCapabilities } from './actions/capability/api';
import type { CapabilityStatus } from './actions/capability/types';

/** Retorna os dados do usuário atual (me), deduplicados por request via cache() do React. */
export const serverMe = cache(async () => {
  try {
    return (await getCurrentUser()).data;
  } catch {
    return null;
  }
});

export const serverFeatureFlags = cache(async (): Promise<Record<string, boolean>> => {
  const { data } = await getMyFeatureFlags();
  return data ?? {};
});

/** Equivalente servidor do hook `useFeatureFlag`. */
export async function serverFeatureFlag(key: string): Promise<boolean> {
  return (await serverFeatureFlags())[key] ?? false;
}

/** Health da IA, deduplicado por request via `cache()`; chame dentro de um Server Component com `<Suspense>`. */
export const serverAiHealth = cache(async (): Promise<AiHealthStatus | null> => {
  const { data } = await getAiHealth();
  return data ?? null;
});

export const serverCapabilities = cache(async (): Promise<Record<string, CapabilityStatus>> => {
  const { data } = await getCapabilities();
  return data ?? {};
});

/** Verifica se o usuário atual tem acesso à rota informada. */
export async function serverCanAccessRoute(path: string): Promise<boolean> {
  const me = await serverMe();
  return !!me?.routes?.some((route) => route.path === path);
}
