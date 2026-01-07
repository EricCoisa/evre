import {
  PaginatedResponse,
  PaginationParams,
} from 'src/common/types/pagination.types';

export interface IBaseService<
  T,
  CreateDto = unknown,
  UpdateDto = unknown,
  PK = string,
> {
  findAll(params?: PaginationParams): Promise<PaginatedResponse<T> | T[]>;
  findOne(...pk: unknown[]): Promise<T | null>;
  create(data: CreateDto, performedById: string): Promise<T>;
  update(pk: PK, data: UpdateDto, performedById: string): Promise<T>;
  remove(
    performedById: string,
    ...pk: unknown[]
  ): Promise<{ status: boolean; message: string }>;
}
