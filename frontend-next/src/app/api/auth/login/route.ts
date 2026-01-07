import { NextResponse } from 'next/server';
import axios from 'axios';

/**
 * API Route para login
 * Realiza login no backend e define cookies HttpOnly
 */
export async function POST(request: Request) {
  const body = await request.json();

  try {
    // Chama endpoint de login no backend
    const backendResponse = await axios.post(
      `${process.env.NEXT_PUBLIC_API_URL}/auth/login`,
      body,
      {
        withCredentials: true,
      }
    );

    // Extrai cookies setados pelo backend
    const setCookie = backendResponse.headers['set-cookie'];
    const { user } = backendResponse.data;

    // Cria resposta para o frontend
    const response = NextResponse.json({ user });
    // Repassa os cookies do backend para o cliente
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
  } catch (error) {
    let message = 'Login failed';
    if (axios.isAxiosError(error)) {
      console.error('Login error response:', error.response?.data);
      message = error.response?.data?.message.message || message;
    } else if (error instanceof Error) {
      message = error.message;
    }
    return NextResponse.json(
      { error: message },
      { status: 401 }
    );
  }
}

