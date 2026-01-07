import { promises as fs } from 'fs';

export function renderTemplate(
  template: string,
  vars: Record<string, unknown> | undefined | null,
  options?: { escapeHtml?: boolean },
): string {
  const escapeHtml = options?.escapeHtml ?? false;

  const lookup = (
    obj: Record<string, unknown> | undefined | null,
    key: string,
  ) => {
    if (!obj) return undefined;
    const parts = key.split('.');
    let cur: unknown = obj;
    for (const p of parts) {
      if (cur == null) return undefined;
      cur = cur[p];
    }
    return cur;
  };

  const esc = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  return template.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, key) => {
    const val = lookup(vars, key as string);
    if (val == null) return '';
    let str: string;
    if (typeof val === 'string') {
      str = val;
    } else if (typeof val === 'number' || typeof val === 'boolean') {
      str = String(val);
    } else if (val instanceof Date) {
      str = val.toISOString();
    } else {
      try {
        str = JSON.stringify(val);
      } catch {
        str = '';
      }
    }
    return escapeHtml ? esc(str) : str;
  });
}

/**
 * Load an HTML file from disk and render it with `renderTemplate`.
 */
export async function renderTemplateFromFile(
  filePath: string,
  vars: Record<string, unknown> | undefined | null,
  options?: { encoding?: BufferEncoding; escapeHtml?: boolean },
): Promise<string> {
  const encoding = options?.encoding ?? 'utf8';
  const content = await fs.readFile(filePath, { encoding });
  return renderTemplate(content, vars, { escapeHtml: options?.escapeHtml });
}

export default renderTemplate;
