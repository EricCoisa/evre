import type { ApiResponse } from '../api/api';

type AxiosLike = { response?: { status?: number; data?: { message?: string; errors?: unknown } }; message?: string };

function extractMessage(e: AxiosLike): string {
  return e?.response?.data?.message ?? e?.message ?? 'Erro desconhecido';
}

function extractErrorDetails(e: AxiosLike) {
  const r = e?.response;
  return {
    message: extractMessage(e),
    status: r?.status ?? 500,
    errors: r?.data?.errors,
  };
}

function errorResponse<T>(err: unknown): ApiResponse<T> {
  const details = extractErrorDetails(err as AxiosLike);
  return {
    success: false,
    data: null as unknown as T,
    message: details.message,
    status: details.status,
    errors: details.errors,
  };
}

// Adapts Promise<T> → ApiResponse<T>; extracts HTTP status/message from Orval/Axios errors
export async function wrap<T>(fn: () => Promise<T>): Promise<ApiResponse<T>> {
  try {
    const data = await fn();
    return { success: true, data, message: '', status: 200 };
  } catch (err: unknown) {
    return errorResponse<T>(err);
  }
}

// Cast variant — use when Orval return type doesn't match the domain type (unknown value fields, index signatures, etc.)
// The cast lives here so adapters stay clean.
export async function wrapAs<T>(fn: () => Promise<unknown>): Promise<ApiResponse<T>> {
  try {
    const data = await fn();
    return { success: true, data: data as T, message: '', status: 200 };
  } catch (err: unknown) {
    return errorResponse<T>(err);
  }
}
