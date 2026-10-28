import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const backendBase = rawApiUrl.replace(/\/api\/v1\/?$/, '');

  try {
    const res = await fetch(`${backendBase}/s/${encodeURIComponent(code)}`, {
      method: 'GET',
      redirect: 'manual',
      cache: 'no-store',
    });

    const location = res.headers.get('location');
    if (location) {
      return NextResponse.redirect(new URL(location, req.nextUrl.origin), 302);
    }

    if (res.status === 404 || res.status === 410) {
      return NextResponse.redirect(new URL('/login?error=link_expired', req.nextUrl.origin), 302);
    }

    return NextResponse.json(
      { message: 'Erro ao resolver link encurtado' },
      { status: res.status },
    );
  } catch {
    return NextResponse.json(
      { message: 'Erro de conexão com o servidor' },
      { status: 502 },
    );
  }
}
