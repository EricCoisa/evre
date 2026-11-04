"use server";
// Thin adapter — wraps generated functions, preserves ApiResponse<T> shape
import type { ApiResponse } from "../../api/api";
import { customInstance } from "@/lib/api/orval-instance";
import { API_PATHS } from "@/lib/generated/paths";
import { getArtifact as getArtifactFactory } from "@/lib/generated/artifact/artifact";
import type { ArtifactControllerListParams } from "@/lib/generated/schemas";
import type { PaginatedResponse, PaginationParams } from "@/lib/types/pagination.types";
import { normalizePaginationParams } from "../normalize-pagination-params";
import { wrap, wrapAs } from "../wrap";
import type { Artifact } from "./types";

const api = getArtifactFactory();

export async function getArtifacts(
  params?: PaginationParams,
): Promise<ApiResponse<PaginatedResponse<Artifact> | Artifact[]>> {
  return wrapAs(() =>
    api.artifactControllerList(
      normalizePaginationParams<ArtifactControllerListParams>(params),
    ),
  );
}

/** "Excluir" um artefato arquiva no servidor — nunca apaga a linha nem a storageKey. */
export async function archiveArtifact(id: string): Promise<ApiResponse<Artifact>> {
  return wrapAs(() => api.artifactControllerArchive(id));
}

/** Multipart puro (sem DTO de body) — o Orval não gera client para isso, mesmo caso de
 * `updateProfile` em `lib/actions/user/api.ts` para o upload de avatar. Aceita arquivo único
 * (html/imagem) ou `.zip` (pasta/site estático), extraído no backend. */
export async function uploadArtifact(file: File): Promise<ApiResponse<Artifact>> {
  const formData = new FormData();
  formData.append("file", file, file.name);
  return wrap(() =>
    customInstance<Artifact>({
      url: API_PATHS.ARTIFACTS,
      method: "POST",
      data: formData,
    }),
  );
}
