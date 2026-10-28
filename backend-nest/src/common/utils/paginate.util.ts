import type { PaginationQuery } from '../schemas/pagination.schema';
import type { PaginatedResponse } from '../types/pagination.types';

/** Pagina uma consulta a partir de `PaginationQuery`, devolvendo `PaginatedResponse` ou array. */
export async function paginate<T, R = T>(
  query: PaginationQuery,
  opts: {
    findMany: (args: { skip?: number; take?: number }) => Promise<T[]>;
    count: () => Promise<number>;
    /** Aplicado nos dois caminhos, paginado ou não. */
    map?: (row: T) => R;
    /** Campos extras no envelope, como o `filter` da tela de logs. */
    extra?: Partial<PaginatedResponse<R>>;
  },
): Promise<PaginatedResponse<R> | R[]> {
  const { page, limit, pagination } = query;
  const map = opts.map ?? ((row: T) => row as unknown as R);

  if (!pagination) {
    return (await opts.findMany({})).map(map);
  }

  const [rows, total] = await Promise.all([
    opts.findMany({ skip: (page - 1) * limit, take: limit }),
    opts.count(),
  ]);

  return {
    data: rows.map(map),
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    ...opts.extra,
  };
}
