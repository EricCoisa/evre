import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getCompanys, getCompany, createCompany, updateCompany, archiveCompany,
  getCompanyContacts, createCompanyContact, updateCompanyContact, archiveCompanyContact,
} from "./api";
import { PaginationParams } from "../../types/pagination.types";
import { getQueryConfig } from '../../utils';
import { Collector } from "@/lib/api/collector";
import { toast } from "sonner";
import { useTranslation } from "@/hooks/use-translation";
import { CreateCompanyDto, UpdateCompanyDto, CreateContactDto, UpdateContactDto } from "./types";

export function useCompanys(params?: PaginationParams) {
  return useQuery({
    queryKey: ['companys', params],
    queryFn: Collector(() => getCompanys(params)),
    ...getQueryConfig('COMPANYS'),
  });
}

export function useCompany(id: string) {
  return useQuery({
    queryKey: ['company', id],
    queryFn: Collector(() => getCompany(id)),
    enabled: !!id,
    ...getQueryConfig('COMPANY'),
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

export function useUpdateCompany() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('company');

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCompanyDto }) =>
      updateCompany(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['companys'] });
      queryClient.invalidateQueries({ queryKey: ['company', variables.id] });
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
