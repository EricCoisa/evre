import { NextRequest, NextResponse } from 'next/server';
import { API_PATHS } from '@/lib/generated/paths';

const ALLOWED_PATHS: readonly string[] = [
  API_PATHS.SYSTEM_CONFIGURATION_DEFAULT_THEME,
  // Adicione outros endpoints públicos permitidos aqui
];

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url || !ALLOWED_PATHS.includes(url)) {
    return NextResponse.json({ message: 'Endpoint não permitido' }, { status: 403 });
  } 
  const backendUrl = `${process.env.NEXT_PUBLIC_API_URL}${url}`;
  const res = await fetch(backendUrl, { cache: 'no-store', next: { revalidate: 0 } });
  if (!res.ok) {
    const text = await res.text().catch(() => '<no-body>');
    return NextResponse.json({ message: 'Erro ao buscar do backend', details: { status: res.status, body: text } }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json(data);
}
