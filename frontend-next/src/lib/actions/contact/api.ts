"use server";
import { GET, POST, ApiResponse } from '../../api/api';
import type { PaginatedResponse, PaginationParams } from '@/lib/types/pagination.types';
import { Contact, CreateContactDto } from './types';

export async function getContacts(
  params?: PaginationParams,
): Promise<ApiResponse<PaginatedResponse<Contact> | Contact[]>> {
  return await GET<PaginatedResponse<Contact> | Contact[]>('/contact', {
    params,
  });
}

export async function createContact(data: CreateContactDto): Promise<ApiResponse<Contact>> {
  return await POST<Contact>('/contact', data);
}
