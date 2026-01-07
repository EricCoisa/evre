"use server";
import { GET, ApiResponse } from '../../api/api';
import { EmailProviderResponse } from './types';

export async function validateConfiguration(): Promise<ApiResponse<EmailProviderResponse>> {
    return await GET<EmailProviderResponse>('/email/validate');
}

