"use server";
// Thin adapter — wraps generated functions, preserves ApiResponse<T> shape
import type { ApiResponse } from "../../api/api";
import { getProposalPublic } from "@/lib/generated/proposal-public/proposal-public";
import type {
  AcceptProposalVersionResponseDto,
  AcceptPublicProposalDto,
  PublicProposalDto,
} from "@/lib/generated/schemas";
import { wrap } from "../wrap";

const api = getProposalPublic();

export async function getPublicProposal(token: string): Promise<ApiResponse<PublicProposalDto>> {
  return wrap(() => api.proposalPublicControllerGetPublic(token));
}

export async function requestProposalRenewal(token: string): Promise<ApiResponse<void>> {
  return wrap(() => api.proposalPublicControllerRequestRenewal(token));
}

/** Idempotente no servidor — duplo clique/retry gravam uma decisão só. */
export async function acceptPublicProposal(
  token: string,
  data: AcceptPublicProposalDto,
): Promise<ApiResponse<AcceptProposalVersionResponseDto>> {
  return wrap(() => api.proposalPublicControllerAccept(token, data));
}
