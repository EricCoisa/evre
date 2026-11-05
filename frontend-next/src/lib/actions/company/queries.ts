"use client";
import { useQuery, useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  getCompanys, createCompany, updateCompany, archiveCompany,
  getCompanyContacts, createCompanyContact, updateCompanyContact, archiveCompanyContact,
  getCompanyMembers, addCompanyMember, inviteCompanyMember, removeCompanyMember, updateCompanyMember, getCompanyInvites,
} from "./api";
import { PaginationParams } from "../../types/pagination.types";
import { getQueryConfig } from '../../utils';
import { Collector } from "@/lib/api/collector";
import { toast } from "sonner";
import { useTranslation } from "@/hooks/use-translation";
import { CreateCompanyDto, UpdateCompanyDto, CreateContactDto, UpdateContactDto, AddCompanyMemberDto, InviteCompanyMemberDto, UpdateCompanyMemberDto } from "./types";

export function useCompanys(params?: PaginationParams) {
  return useQuery({
    queryKey: ['companys', params],
    queryFn: Collector(() => getCompanys(params)),
    ...getQueryConfig('COMPANYS'),
  });
}

export function useCreateCompany() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('company');

  return useMutation({
    mutationFn: (data: CreateCompanyDto) => createCompany(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companys'] });
      toast.success(t('createdSuccess'));
    }
  });
}

/** Invalida as chaves passadas e força um novo render do servidor — `company/[id]` é Server
 * Component e passa o registro como prop estática, então `invalidateQueries` sozinho é no-op
 * sobre o que a página já renderizou. */
function useCompanySync() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return (keys: QueryKey[]) => {
    keys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
    router.refresh();
  };
}

export function useUpdateCompany() {
  const sync = useCompanySync();
  const { t } = useTranslation('company');

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCompanyDto }) =>
      updateCompany(id, data),
    onSuccess: (_, variables) => {
      sync([['companys'], ['company', variables.id]]);
      toast.success(t('updatedSuccess'));
    }
  });
}

export function useArchiveCompany() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('company');

  return useMutation({
    mutationFn: archiveCompany,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companys'] });
      toast.success(t('archivedSuccess'));
    }
  });
}

export function useCompanyContacts(companyId: string) {
  return useQuery({
    queryKey: ['company', companyId, 'contacts'],
    queryFn: Collector(() => getCompanyContacts(companyId)),
    enabled: !!companyId,
    ...getQueryConfig('COMPANY'),
  });
}

export function useCreateCompanyContact(companyId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation('company');

  return useMutation({
    mutationFn: (data: CreateContactDto) => createCompanyContact(companyId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company', companyId, 'contacts'] });
      toast.success(t('contacts.createdSuccess'));
    }
  });
}

export function useUpdateCompanyContact(companyId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation('company');

  return useMutation({
    mutationFn: ({ contactId, data }: { contactId: string; data: UpdateContactDto }) =>
      updateCompanyContact(companyId, contactId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company', companyId, 'contacts'] });
      toast.success(t('contacts.updatedSuccess'));
    }
  });
}

export function useArchiveCompanyContact(companyId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation('company');

  return useMutation({
    mutationFn: (contactId: string) => archiveCompanyContact(companyId, contactId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company', companyId, 'contacts'] });
      toast.success(t('contacts.archivedSuccess'));
    }
  });
}

export function useCompanyMembers(companyId: string, params?: PaginationParams) {
  return useQuery({
    queryKey: ['company', companyId, 'members', params],
    queryFn: Collector(() => getCompanyMembers(companyId, params)),
    enabled: !!companyId,
    ...getQueryConfig('COMPANY'),
  });
}

export function useCompanyInvites(companyId: string) {
  return useQuery({
    queryKey: ['company', companyId, 'invites'],
    queryFn: Collector(() => getCompanyInvites(companyId)),
    enabled: !!companyId,
    ...getQueryConfig('COMPANY'),
  });
}

export function useAddCompanyMember(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AddCompanyMemberDto) => addCompanyMember(companyId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company', companyId, 'members'] });
      toast.success('Membro adicionado');
    },
  });
}

export function useInviteCompanyMember(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: InviteCompanyMemberDto) => inviteCompanyMember(companyId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company', companyId, 'members'] });
      queryClient.invalidateQueries({ queryKey: ['company', companyId, 'invites'] });
      toast.success('Convite enviado');
    },
  });
}

export function useUpdateCompanyMember(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ membershipId, data }: { membershipId: string; data: UpdateCompanyMemberDto }) =>
      updateCompanyMember(companyId, membershipId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company', companyId, 'members'] });
      toast.success('Permissão atualizada');
    },
  });
}

export function useRemoveCompanyMember(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (membershipId: string) => removeCompanyMember(companyId, membershipId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company', companyId, 'members'] });
      toast.success('Membro removido');
    },
  });
}
