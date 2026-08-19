import {NextResponse} from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      service: 'berita-auto-backend',
      runtime: 'render',
    },
    {
      status: 200,
      headers: {'Cache-Control': 'no-store'},
    },
  );
}
