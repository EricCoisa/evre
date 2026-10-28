import type { ApiResponse } from './api/api';

/** Converte o envelope da API em uma Promise que rejeita em caso de falha. */
export async function unwrap<T>(call: Promise<ApiResponse<T>>): Promise<T> {
  const res = await call;
  if (!res.success) throw new Error(res.message);
  return res.data;
}
