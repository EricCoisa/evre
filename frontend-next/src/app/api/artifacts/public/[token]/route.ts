import { type NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const res = await fetch(`${API_BASE}/artifacts/public/${token}`);

  if (!res.ok || !res.body) return new NextResponse(null, { status: res.status });

  return new NextResponse(res.body, {
    headers: {
      'Content-Type': res.headers.get('Content-Type') ?? 'application/octet-stream',
      'Content-Disposition': res.headers.get('Content-Disposition') ?? '',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
