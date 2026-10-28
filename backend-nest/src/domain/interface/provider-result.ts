/** Resultado de uma operação contra um serviço externo plugável (email, storage, IA…). */
export interface ProviderResult {
  status: boolean;
  data: string;
}
