import { deleteServerAccessToken, deleteServerRefreshToken, getServerAccessToken, getServerLang, getServerRefreshToken } from '@/lib/actions/auth/server-auth';
import { NextResponse } from 'next/server';
import axios from 'axios';
import { clientIpHeader } from '@/lib/api/client-ip';
import { API_PATHS } from '@/lib/generated/paths';

/** Revoga o refresh token no backend e limpa os cookies. */
export async function POST() {

  try {
    // Pega os cookies para enviar ao backend
    const accessToken = await getServerAccessToken();
    const refreshToken = await getServerRefreshToken();

    // Chama o backend para revogar o refresh token no banco
    if (accessToken || refreshToken) {
      const backendResponse = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}${API_PATHS.AUTH_LOGOUT}`,
        {},
        {
          withCredentials: true,
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken && { 'Authorization': `Bearer ${accessToken}` }),
            'Cookie': `access_token=${accessToken}; refresh_token=${refreshToken}`,
            ...(await clientIpHeader()),
            'Accept-Language': (await getServerLang()) ?? 'pt-BR',
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
