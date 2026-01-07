export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  filter?: Record<string, string[]>;
}

export interface PaginationParams {
  page: number;
  limit: number;
  pagination: boolean;
  search?: string;
  filter?: Record<string, string>;
}
