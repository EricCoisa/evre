"use server";
import { GET, ApiResponse, POST, GET_BLOB } from '../../api/api';
import type { AuthUser, ForgotPasswordDto, ResetPasswordDto, ResetPasswordResponse } from '@/lib/actions/auth/types';

export async function getCurrentUser(): Promise<ApiResponse<AuthUser>> {
    return await GET<AuthUser>('/auth/me');
}

export async function getProfile(): Promise<ApiResponse<AuthUser>> {
    const user = await GET<AuthUser>('/auth/user');
    
    // Busca a imagem e converte para data URL
    try {
        const imageDataUrl = await getUserImageById(user.data.id);
        user.data.image = imageDataUrl;
    } catch (error) {
        console.error('Erro ao carregar imagem do usuário:', error);
        user.data.image = null;
    }
    
    return user;
}

export async function getUserImageById(id: string): Promise<string | null> {
  try {
    const response = await GET_BLOB(`/user/${id}/get-user-image`);
    
    if (!response.success || !response.data) {
      return null;
    }
    
    // Converte Blob/ArrayBuffer para Buffer e então para base64
    const arrayBuffer = await response.data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');

    return `data:image/jpeg;base64,${base64}`;
  } catch (error) {
    console.error('Erro ao buscar imagem:', error);
    return null;
  }
}

export async function forgotPassword(data: ForgotPasswordDto): Promise<ApiResponse<true>> {
  return await POST<true>('/auth/forgot-password', data);
}



export async function resetPassword(data: ResetPasswordDto): Promise<ApiResponse<ResetPasswordResponse>> {
  return await POST<ResetPasswordResponse>('/auth/reset-password', data);
}

export async function checkResetToken(token: string): Promise<ApiResponse<{ valid: boolean }>> {
  return await GET<{ valid: boolean }>(`/auth/check-reset-token?token=${token}`);
}