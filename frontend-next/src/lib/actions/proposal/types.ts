// Re-export generated schemas so screens get stable import paths
export type {
  ProposalDto as Proposal,
  CreateProposalDto,
  UpdateProposalDto,
  UpdateProposalLayoutDto,
  UpdateProposalTermsDto,
  UpdateProposalStatusDto,
  ProposalArtifactDto,
  ProposalVersionDto,
  PublishProposalResponseDto,
  RevokeProposalPublicationResponseDto,
  AcceptProposalOfflineDto,
  AcceptProposalVersionResponseDto,
  SendProposalDto,
  SendProposalResponseDto,
  ProposalSendDto,
} from '@/lib/generated/schemas';
export { ProposalDtoStatus as ProposalStatus } from '@/lib/generated/schemas';
export { ProposalDtoRecurrence as ProposalRecurrence } from '@/lib/generated/schemas';
