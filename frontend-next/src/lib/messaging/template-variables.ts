// Mesma sintaxe de `{{ nome }}` usada pelo backend (template.util.ts) — duplicar o regex aqui é
// mais simples do que compartilhar código entre front e back por uma linha.
const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

export function usedVariableNames(...texts: (string | undefined)[]): Set<string> {
  const names = new Set<string>();
  for (const text of texts) {
    if (!text) continue;
    for (const match of text.matchAll(PLACEHOLDER_RE)) names.add(match[1]);
  }
  return names;
}
