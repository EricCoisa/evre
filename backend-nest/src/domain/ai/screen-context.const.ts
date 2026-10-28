/** O que o usuário tem montado na tela, declarado pelos componentes do front. */
export interface ScreenItem {
  kind: 'collection' | 'config' | 'record';
  /** 1º segmento da queryKey do React Query (`users`, `system-configuration`, …). */
  source: string;
  /** `config` → labelKey; `record` → id do registro; `collection` → ausente. */
  detail?: string;
}

/** Mapeia `source` da tela para grupos do ToolRegistry (slug do módulo dono da tool). */
export const SCREEN_SOURCE_TOOL_GROUPS: Record<string, string[]> = {
  users: ['user'],
  user: ['user'],
  me: ['user'],
  routes: ['route'],
  route: ['route'],
  'feature-flags': ['feature-flag'],
  'feature-flags-me': ['feature-flag'],
  invites: ['auth'],
  roleRouteAccess: ['role-route-access'],
  userRoles: ['role', 'role-route-access'],
  userRouteAccess: ['user-route-access'],
  'system-configuration': ['system-configuration'],
  'user-configurations-definitions': ['user-configuration-definition'],
  'user-configurations': ['user-configuration'],
  'user-configuration': ['user-configuration'],
  'api-keys': ['api-key'],
  cms: ['cms'],
};

/** Teto de nomes de tool citados — uma tela agregadora (ex. /access) cobre 4 domínios. */
const MAX_TOOL_NAMES = 25;

/** Renderiza o que está na tela como bloco do system prompt; `null` se não houver nada a dizer. */
export function describeScreen(
  items: ScreenItem[],
  tools: { name: string; group: string }[],
): string | null {
  const groups = new Set<string>();
  const collections = new Set<string>();
  const configs = new Set<string>();
  const records = new Set<string>();

  for (const item of items) {
    for (const group of SCREEN_SOURCE_TOOL_GROUPS[item.source] ?? []) {
      groups.add(group);
    }
    if (item.kind === 'collection') collections.add(item.source);
    else if (item.kind === 'config' && item.detail) configs.add(item.detail);
    else if (item.kind === 'record' && item.detail) {
      records.add(`${item.source} id=${item.detail}`);
    }
  }

  const lines: string[] = [];
  if (collections.size) {
    lines.push(`- listagens abertas: ${[...collections].join(', ')}`);
  }
  if (records.size) {
    lines.push(`- registro aberto: ${[...records].join(', ')}`);
  }
  if (configs.size) {
    lines.push(`- chaves de configuração visíveis: ${[...configs].join(', ')}`);
  }

  const toolNames = tools
    .filter((tool) => groups.has(tool.group))
    .map((tool) => tool.name)
    .slice(0, MAX_TOOL_NAMES);
  if (toolNames.length) {
    lines.push(`- ferramentas desse domínio: ${toolNames.join(', ')}`);
  }

  if (!lines.length) return null;

  return [
    'O usuário está vendo isto na tela:',
    ...lines,
    'Use para entender a que ele se refere ("essa configuração", "esse registro"). ' +
      'Os valores NÃO estão aqui — busque com as ferramentas quando precisar deles.',
  ].join('\n');
}
