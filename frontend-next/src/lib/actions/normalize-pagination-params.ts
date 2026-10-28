// Normalize PaginationParams to Orval-generated param types
// Orval generates filter as Object, but PaginationParams uses string | Record
import type { PaginationParams } from '@/lib/types/pagination.types';

export function normalizePaginationParams<T extends Record<string, unknown>>(
  params?: PaginationParams,
): T | undefined {
  if (!params) return undefined;

  const { page, limit, pagination, search, filter } = params;

  let resolvedFilter: string | undefined = undefined;
  if (typeof filter === 'string') {
    resolvedFilter = filter.trim() ? filter : undefined;
  } else if (filter && typeof filter === 'object' && Object.keys(filter).length > 0) {
    resolvedFilter = JSON.stringify(filter);
  }

  return {
    page,
    limit,
    pagination,
    search,
    ...(resolvedFilter !== undefined ? { filter: resolvedFilter } : {}),
  } as unknown as T;
}
