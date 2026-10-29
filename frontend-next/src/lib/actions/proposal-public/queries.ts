'use client';

import { useMutation } from '@tanstack/react-query';
import { Alive } from '@/lib/api/collector';
import { acceptPublicProposal, requestProposalRenewal } from './api';
import type { AcceptPublicProposalDto } from '@/lib/generated/schemas';

export function useAcceptPublicProposal() {
  return useMutation({
    mutationFn: ({ token, data }: { token: string; data: AcceptPublicProposalDto }) =>
      Alive(() => acceptPublicProposal(token, data))(),
  });
}

export function useRequestProposalRenewal() {
  return useMutation({
    mutationFn: (token: string) => Alive(() => requestProposalRenewal(token))(),
  });
}
