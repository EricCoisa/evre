"use server";
// Thin adapter — wraps generated functions, preserves ApiResponse<T> shape
import type { ApiResponse } from "../../api/api";
import { getProposal as getProposalFactory } from "@/lib/generated/proposal/proposal";
import type {
  AcceptProposalOfflineDto,
  AcceptProposalVersionResponseDto,
  CreateProposalDto,
  ProposalControllerFindAllParams,
  ProposalSendDto,
  ProposalVersionDto,
  PublishProposalResponseDto,
  RevokeProposalPublicationResponseDto,
  SendProposalDto,
  SendProposalResponseDto,
  UpdateProposalDto,
  UpdateProposalLayoutDto,
  UpdateProposalStatusDto,
  UpdateProposalTermsDto,
} from "@/lib/generated/schemas";
import type { PaginatedResponse, PaginationParams } from "@/lib/types/pagination.types";
import { normalizePaginationParams } from "../normalize-pagination-params";
import { wrap, wrapAs } from "../wrap";
import type { Proposal } from "./types";

const api = getProposalFactory();

export async function getProposals(
  params?: PaginationParams,
): Promise<ApiResponse<PaginatedResponse<Proposal> | Proposal[]>> {
  return wrapAs(() =>
    api.proposalControllerFindAll(
      normalizePaginationParams<ProposalControllerFindAllParams>(params),
    ),
  );
}

export async function getProposal(id: string): Promise<ApiResponse<Proposal>> {
  return wrapAs(() => api.proposalControllerFindOne(id));
}

export async function createProposal(data: CreateProposalDto): Promise<ApiResponse<Proposal>> {
  return wrapAs(() => api.proposalControllerCreate(data));
}

export async function updateProposal(
  id: string,
  data: UpdateProposalDto,
): Promise<ApiResponse<Proposal>> {
  return wrapAs(() => api.proposalControllerUpdate(id, data));
}

/** "Excluir" uma proposta arquiva no servidor — nada é apagado. */
export async function archiveProposal(id: string): Promise<ApiResponse<Proposal>> {
  return wrapAs(() => api.proposalControllerRemove(id));
}

/** Copia nome, layout e envelope; a cópia nasce DRAFT, sem versão nem token. */
export async function duplicateProposal(id: string): Promise<ApiResponse<Proposal>> {
  return wrapAs(() => api.proposalControllerDuplicate(id));
}

export async function updateProposalLayout(
  id: string,
  data: UpdateProposalLayoutDto,
): Promise<ApiResponse<Proposal>> {
  return wrapAs(() => api.proposalControllerUpdateLayout(id, data));
}

export async function updateProposalTerms(
  id: string,
  data: UpdateProposalTermsDto,
): Promise<ApiResponse<Proposal>> {
  return wrapAs(() => api.proposalControllerUpdateTerms(id, data));
}

export async function updateProposalStatus(
  id: string,
  data: UpdateProposalStatusDto,
): Promise<ApiResponse<Proposal>> {
  return wrapAs(() => api.proposalControllerUpdateStatus(id, data));
}

/** Congela a versão atual: revoga o link anterior e devolve a URL pública nova. */
export async function publishProposal(id: string): Promise<ApiResponse<PublishProposalResponseDto>> {
  return wrap(() => api.proposalControllerPublish(id));
}

/** Idempotente no servidor — revogar duas vezes não é erro. */
export async function revokeProposalPublication(id: string): Promise<ApiResponse<RevokeProposalPublicationResponseDto>> {
  return wrap(() => api.proposalControllerRevoke(id));
}

export async function listProposalVersions(id: string): Promise<ApiResponse<ProposalVersionDto[]>> {
  return wrap(() => api.proposalControllerListVersions(id));
}

/** Registra o aceite recebido por outro canal (telefone, reunião, email) — sempre a versão vigente. */
export async function acceptProposalOffline(
  id: string,
  data: AcceptProposalOfflineDto,
): Promise<ApiResponse<AcceptProposalVersionResponseDto>> {
  return wrap(() => api.proposalControllerAcceptOffline(id, data));
}

/** Canal indisponível não é erro: a rota responde 200 com `succeeded: false` e a URL curta sempre. */
export async function sendProposal(
  id: string,
  data: SendProposalDto,
): Promise<ApiResponse<SendProposalResponseDto>> {
  return wrap(() => api.proposalControllerSend(id, data));
}

export async function listProposalSends(
  id: string,
): Promise<ApiResponse<ProposalSendDto[]>> {
  return wrap(() => api.proposalControllerListSends(id));
}

