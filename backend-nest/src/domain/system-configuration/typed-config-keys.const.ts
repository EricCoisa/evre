/** Chaves de `SystemConfiguration` que pertencem a um formulário de provider validado, e a tool que deve escrevê-las. */
const TYPED_CONFIG_OWNERS: ReadonlyArray<{
  readonly tool: string;
  readonly prefix?: string;
  readonly keys?: readonly string[];
}> = [
  { tool: 'save_storage_config', prefix: 'SYSTEM_STORAGE_' },
  { tool: 'save_email_config', prefix: 'SYSTEM_EMAIL_' },
  {
    tool: 'save_captcha_config',
    keys: [
      'SYSTEM_CAPTCHA_PROVIDER',
      'SYSTEM_CAPTCHA_SITE_KEY',
      'SYSTEM_CAPTCHA_SECRET_KEY',
    ],
  },
];

/** Nome da tool que deve escrever esta chave, ou `null` se é chave genérica. */
export function typedConfigOwner(labelKey?: string | null): string | null {
  if (!labelKey) return null;
  const key = labelKey.trim().toUpperCase();
  for (const owner of TYPED_CONFIG_OWNERS) {
    if (owner.prefix && key.startsWith(owner.prefix)) return owner.tool;
    if (owner.keys?.includes(key)) return owner.tool;
  }
  return null;
}

/** Mensagem única, para as três tools genéricas dizerem a mesma coisa. */
export function typedConfigRefusal(labelKey: string, tool: string): string {
  return (
    `A chave ${labelKey} é gerenciada pela tool "${tool}", que valida a ` +
    `configuração contra o provider real antes de gravar. Escrever nela por aqui ` +
    `persistiria credencial sem validação. Use "${tool}".`
  );
}

/** Estado de um segredo para tools de leitura: `'configurado'` ou `'não configurado'`, nunca o valor. */
export function secretStatus(value: string | null | undefined): string {
  return value ? 'configurado' : 'não configurado';
}
