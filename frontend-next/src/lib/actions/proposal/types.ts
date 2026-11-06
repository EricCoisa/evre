// Re-export generated schemas so screens get stable import paths
export type {
  ProposalDto as Proposal,
  CreateProposalDto,
  UpdateProposalDto,
  UpdateProposalLayoutDto,
  UpdateProposalTermsDto,
  UpdateProposalStatusDto,
  ProposalVersionDto,
  PublishProposalResponseDto,
  RevokeProposalPublicationResponseDto,
  AcceptProposalOfflineDto,
  AcceptProposalVersionResponseDto,
  SendProposalResponseDto,
  ProposalSendDto,
} from '@/lib/generated/schemas';
export type { SendProposalDto } from './api';
export { ProposalDtoStatus as ProposalStatus } from '@/lib/generated/schemas';
export { ProposalDtoRecurrence as ProposalRecurrence } from '@/lib/generated/schemas';
