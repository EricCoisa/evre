"use client";
import { useMutation, useQuery } from '@tanstack/react-query';
import { requestVerification, confirmVerification, getVerificationChannelHealth } from './api';
import { Alive, Collector } from '@/lib/api/collector';
import type { RequestVerificationInput, ConfirmVerificationInput, VerificationChannel } from './types';

export function useRequestVerification() {
  return useMutation({
    mutationFn: (input: RequestVerificationInput) => Alive(() => requestVerification(input))(),
  });
}

export function useConfirmVerification() {
  return useMutation({
    mutationFn: (input: ConfirmVerificationInput) => Alive(() => confirmVerification(input))(),
  });
}

/** Mesmo padrão de useStorageHealth/useEmailHealth — ver docs/frontend/service-health-gate.md. */
export function useVerificationChannelHealth(channel: VerificationChannel) {
  return useQuery({
    queryKey: ['verification', 'health', channel],
    queryFn: Collector(() => getVerificationChannelHealth(channel)),
    staleTime: 1000 * 60 * 4,
    refetchOnWindowFocus: false,
  });
}
