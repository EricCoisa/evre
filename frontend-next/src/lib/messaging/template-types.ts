/** Forma canônica do contrato de um tipo, ignorando ordem de chaves e campos vazios. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined && v !== null && v !== '' && v !== false)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonical(v)]),
    );
  }
  return value;
}

/** O contrato do tipo mudou? Só variáveis e botões importam: o nome do tipo não afeta nenhum template. */
export function contractChanged(
  before: { variables: unknown; buttons: unknown },
  after: { variables: unknown; buttons: unknown },
): boolean {
  return (
    JSON.stringify(canonical(before.variables)) !== JSON.stringify(canonical(after.variables)) ||
    JSON.stringify(canonical(before.buttons)) !== JSON.stringify(canonical(after.buttons))
  );
}
