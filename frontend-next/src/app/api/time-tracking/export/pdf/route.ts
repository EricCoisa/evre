import { type NextRequest, NextResponse } from 'next/server';
import { getServerAccessToken } from '@/lib/actions/auth/server-auth';
import { API_PATHS } from '@/lib/generated/paths';

const BACKEND =
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:3001/api/v1';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = await getServerAccessToken();
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const params = request.nextUrl.searchParams.toString();
  const url = `${BACKEND}${API_PATHS.TIME_TRACKING_EXPORT}/pdf${params ? `?${params}` : ''}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Accept-Language': 'pt-BR',
    },
  });

  if (!res.ok) {
    return NextResponse.json({ error: 'PDF generation failed' }, { status: res.status });
  }

  const buffer = await res.arrayBuffer();
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition':
        res.headers.get('Content-Disposition') ?? 'attachment; filename="relatorio-tempo.pdf"',
    },
  });
}
