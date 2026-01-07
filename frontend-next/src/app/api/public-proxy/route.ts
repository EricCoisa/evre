import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_PATHS = [
  '/system-configuration/default-theme',
  // Adicione outros endpoints públicos permitidos aqui
];

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url || !ALLOWED_PATHS.includes(url)) {
    return NextResponse.json({ error: 'Endpoint não permitido' }, { status: 403 });
  } 
  const backendUrl = `${process.env.NEXT_PUBLIC_API_URL}${url}`;
  const res = await fetch(backendUrl, { cache: 'no-store', next: { revalidate: 0 } });
  if (!res.ok) {
    console.error('Error fetching from backend:', res.statusText);
    return NextResponse.json({ error: 'Erro ao buscar do backend' }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json(data);
}
