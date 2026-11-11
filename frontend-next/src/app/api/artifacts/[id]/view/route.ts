import { type NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { API_PATHS } from '@/lib/generated/paths';

const ACCESS_TOKEN_COOKIE = process.env.ACCESS_TOKEN_COOKIE_NAME || 'access_token';
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const token = (await cookies()).get(ACCESS_TOKEN_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  // Segue o redirect para a presigned URL server-side — não expõe a URL do S3 ao browser.
  const res = await fetch(`${API_BASE}${API_PATHS.ARTIFACTS_BY_ID_VIEW(id)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok || !res.body) return new NextResponse(null, { status: res.status });

  return new NextResponse(res.body, {
    headers: {
      'Content-Type': res.headers.get('Content-Type') ?? 'application/octet-stream',
      'Content-Disposition': res.headers.get('Content-Disposition') ?? '',
      'Cache-Control': 'private, max-age=300',
    },
  });
}
