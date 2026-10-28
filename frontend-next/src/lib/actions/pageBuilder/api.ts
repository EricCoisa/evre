"use server";
// Adapter fino: cada função é a contraparte de um endpoint marcado com `pageSource` no backend.
import { getUser } from '@/lib/generated/user/user';
import { getLogging } from '@/lib/generated/logging/logging';
import { getPageBuilder } from '@/lib/generated/page-builder/page-builder';
import type { PageSourceDto } from '@/lib/generated/schemas';
import type { ApiResponse } from '@/lib/api/api';
import type { ListResponse, SeriesResponse } from '@/lib/page-builder/types';
import type { PageLayout } from '@/lib/page-builder/schema';
import { wrap, wrapAs } from '../wrap';

const userApi = getUser();
const loggingApi = getLogging();
const pageBuilderApi = getPageBuilder();

// Params vêm do JSON do layout sem tipo; quem valida é o ZodValidationPipe do endpoint.
type Params = Record<string, unknown> | undefined;

export async function fetchUsersList(params?: Params): Promise<ApiResponse<ListResponse>> {
  return wrapAs(() => userApi.userControllerFindAll(params as never));
}

export async function fetchLogsList(params?: Params): Promise<ApiResponse<ListResponse>> {
  return wrapAs(() => loggingApi.loggingControllerFindAll(params as never));
}

export async function fetchSignupsSeries(params?: Params): Promise<ApiResponse<SeriesResponse>> {
  return wrapAs(() => userApi.userControllerSignupsSeries(params as never));
}

// Editor visual: catálogo de fontes que este usuário alcança e a escrita do layout.

export async function fetchPageSources(): Promise<ApiResponse<PageSourceDto[]>> {
  return wrapAs(() => pageBuilderApi.pageBuilderControllerListSources());
}

export async function savePageLayout(
  pageKey: string,
  layout: PageLayout,
): Promise<ApiResponse<void>> {
  // O DTO gerado descreve o layout com tipos frouxos (props/params são registros abertos no
  // OpenAPI); PageLayout é o mesmo shape com os literais certos. O cast mora aqui, na borda.
  return wrap(() =>
    pageBuilderApi.pageBuilderControllerSaveLayout({ pageKey, layout } as never),
  );
}

/** Layout padrão do sistema; leitura liberada a qualquer autenticado, escrita só ADMIN. */
export async function fetchSystemPageLayouts(): Promise<
  ApiResponse<{ layouts: Record<string, unknown> }>
> {
  return wrapAs(() => pageBuilderApi.pageBuilderControllerListSystemLayouts());
}

export async function saveSystemPageLayout(
  pageKey: string,
  layout: PageLayout,
): Promise<ApiResponse<void>> {
  return wrap(() =>
    pageBuilderApi.pageBuilderControllerSaveSystemLayout({
      pageKey,
      layout,
    } as never),
  );
}
