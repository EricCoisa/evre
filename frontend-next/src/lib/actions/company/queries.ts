import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getCompanys, getCompany, createCompany, updateCompany, archiveCompany,
  getCompanyContacts, createCompanyContact, updateCompanyContact, archiveCompanyContact,
} from "./api";
import { PaginationParams } from "../../types/pagination.types";
import { getQueryConfig } from '../../utils';
import { Collector } from "@/lib/api/collector";
import { toast } from "sonner";
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

  return useMutation({
    mutationFn: (data: CreateCompanyDto) => createCompany(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companys'] });
      toast.success('Company created successfully');
    }
  });
}

export function useUpdateCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCompanyDto }) =>
      updateCompany(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['companys'] });
      queryClient.invalidateQueries({ queryKey: ['company', variables.id] });
      toast.success('Company updated successfully');
    }
  });
}

export function useArchiveCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: archiveCompany,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companys'] });
      toast.success('Company archived successfully');
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

  return useMutation({
    mutationFn: (data: CreateContactDto) => createCompanyContact(companyId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company', companyId, 'contacts'] });
      toast.success('Contact created successfully');
    }
  });
}

export function useUpdateCompanyContact(companyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ contactId, data }: { contactId: string; data: UpdateContactDto }) =>
      updateCompanyContact(companyId, contactId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company', companyId, 'contacts'] });
      toast.success('Contact updated successfully');
    }
  });
}

export function useArchiveCompanyContact(companyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (contactId: string) => archiveCompanyContact(companyId, contactId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company', companyId, 'contacts'] });
      toast.success('Contact archived successfully');
    }
  });
}
