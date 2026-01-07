import { deleteServerAccessToken, deleteServerRefreshToken, getServerAccessToken, getServerRefreshToken } from '@/lib/actions/auth/server-auth';
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

/**
 * API Route para logout
 * Chama o backend para revogar o refresh token e limpa cookies
 */
export async function POST(request: NextRequest) {

  try {
    // Pega os cookies para enviar ao backend
    const accessToken = await getServerAccessToken();
    const refreshToken = await getServerRefreshToken();

    // Chama o backend para revogar o refresh token no banco
    if (accessToken || refreshToken) {
      const backendResponse = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/logout`,
        {},
        {
          withCredentials: true,
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken && { 'Authorization': `Bearer ${accessToken}` }),
            'Cookie': `access_token=${accessToken}; refresh_token=${refreshToken}`,
          },
        }
      );

      // Extrai cookies de limpeza setados pelo backend
      const setCookie = backendResponse.headers['set-cookie'];
      
      // Cria resposta para o frontend
      const response = NextResponse.json({ 
        success: true, 
        message: backendResponse.data.message || 'Logout realizado com sucesso' 
      });

      // Repassa os cookies do backend para o cliente (limpeza dos cookies)
      if (setCookie) {
        if (Array.isArray(setCookie)) {
          for (const cookie of setCookie) {
            response.headers.append('set-cookie', cookie);
          }
        } else {
          response.headers.set('set-cookie', setCookie);
        }
      }

      return response;
    }
  } catch (error) {
    console.error('Erro ao revogar token no backend:', error);
    // Continua mesmo se falhar (pelo menos limpa cookies locais)
  }

  // Remove cookies localmente usando funções centralizadas como fallback
  await deleteServerAccessToken();
  await deleteServerRefreshToken();

  // Retorna sucesso em JSON
  return NextResponse.json({ 
    success: true, 
    message: 'Logout realizado com sucesso' 
  });
}
