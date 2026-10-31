import type { PaginatedResponse } from '../types/pagination.types';

/** Máscara de resposta: o que sai pela API quando a linha está marcada `secret`. */
const MASK = '****';

const SEED_PLACEHOLDERS = new Set([
  'sk-placeholder',
  'sk-ant-placeholder',
  'aaaaaaaa-bbbb-cccc-dddd-aaaaaaaaaaaa',
  'smtp.example.com',
  'user@example.com',
  'pass123',
  'minioadmin',
  'http://localhost:8333',
  'http://localhost:8333/template',
  'http://localhost:3000',
  '000-000-000',
]);

export function maskSecretValue<T extends object, K extends keyof T>(
  row: T,
  field: K,
): T {
  // `secret` lido por indexação e não por constraint: um tipo só de campos
  // opcionais dispara a checagem de weak type do TS em todo call-site.
  const isSecret = Boolean((row as { secret?: boolean | null })?.secret);
  if (!isSecret) return row;

  const val = row[field];
  if (
    !val ||
    typeof val !== 'string' ||
    !val.trim() ||
    SEED_PLACEHOLDERS.has(val.trim())
  ) {
    return { ...row, [field]: '' as T[K] };
  }

  return { ...row, [field]: MASK as T[K] };
}

export function maskSecretValues<T extends object, K extends keyof T>(
  result: PaginatedResponse<T> | T[],
  field: K,
): PaginatedResponse<T> | T[] {
  if (Array.isArray(result)) {
    return result.map((row) => maskSecretValue(row, field));
  }
  return {
    ...result,
    data: result.data.map((row) => maskSecretValue(row, field)),
  };
}
