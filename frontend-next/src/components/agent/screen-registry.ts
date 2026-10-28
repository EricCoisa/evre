"use client";

import { useEffect } from 'react';

/** Identidade do que está montado na tela — usada pelo agente para saber a que o usuário se refere. */
export interface ScreenItem {
  kind: 'collection' | 'config' | 'record';
  source: string;
  /** `config` → labelKey; `record` → id do registro; `collection` → ausente. */
  detail?: string;
}

// Registry de módulo com contagem de montagens por chave
const registry = new Map<string, { item: ScreenItem; mounted: number }>();

/** Registra o item no contexto de tela enquanto o componente estiver montado. */
export function useScreenItem(
  kind: ScreenItem['kind'],
  source: string,
  detail?: string,
): void {
  useEffect(() => {
    if (!source) return;
    const key = `${kind}:${source}:${detail ?? ''}`;
    const entry = registry.get(key);
    if (entry) entry.mounted += 1;
    else {
      registry.set(key, {
        item: { kind, source, ...(detail ? { detail } : {}) },
        mounted: 1,
      });
    }
    return () => {
      const current = registry.get(key);
      if (!current) return;
      if (current.mounted > 1) current.mounted -= 1;
      else registry.delete(key);
    };
  }, [kind, source, detail]);
}

/** Tudo que está na tela neste instante. Limitado porque vai para o prompt. */
export function snapshotScreen(limit = 40): ScreenItem[] {
  return [...registry.values()].slice(0, limit).map((entry) => entry.item);
}
