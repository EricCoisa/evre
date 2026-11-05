// Re-export generated schemas so screens get stable import paths
import type { CompanyDto } from '@/lib/generated/schemas';
export type { CreateCompanyDto, UpdateCompanyDto } from '@/lib/generated/schemas';
export type { ContactDto as Contact, CreateContactDto, UpdateContactDto } from '@/lib/generated/schemas';
export type { AddCompanyMemberDto, InviteCompanyMemberDto } from '@/lib/generated/schemas';

export type Company = CompanyDto & {
  myMembership?: { canSeeCommercials: boolean; canComment: boolean };
};

export interface UpdateCompanyMemberDto {
  canSeeCommercials?: boolean;
  canComment?: boolean;
}
