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

export interface CompanyMember {
  id: string;
  userId: string;
  canSeeCommercials: boolean;
  canComment: boolean;
  createdAt: string;
  user: {
    id: string;
    email: string;
    name?: string | null;
    status?: string;
    imageUrl?: string | null;
    roleRecord?: { name: string } | null;
  };
}

export interface CompanyInvite {
  id: string;
  email: string;
  roleId: string;
  roleName: string;
  createdByName: string | null;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
  actionUrl?: string | null;
}
