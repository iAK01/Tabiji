import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

// Serves a stored upload from our own origin. The bucket sends no CORS headers, so the
// in-app PDF viewer (which reads the file's bytes) can't fetch the storage URL directly.
// Only objects in our own bucket — never an arbitrary URL.
const BUCKET = process.env.GOOGLE_CLOUD_BUCKET_NAME;

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  let target: URL;
  try {
    target = new URL(req.nextUrl.searchParams.get('url') ?? '');
  } catch {
    return NextResponse.json({ error: 'Bad file URL' }, { status: 400 });
  }
  if (!BUCKET || target.origin !== 'https://storage.googleapis.com' || !target.pathname.startsWith(`/${BUCKET}/`)) {
    return NextResponse.json({ error: 'Bad file URL' }, { status: 400 });
  }

  const upstream = await fetch(target.href, { cache: 'no-store' });
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: 'File not found' }, { status: upstream.status === 404 ? 404 : 502 });
  }
  const headers = new Headers({
    'Content-Type':  upstream.headers.get('content-type') ?? 'application/octet-stream',
    'Cache-Control': 'private, max-age=3600',
  });
  return new Response(upstream.body, { headers });
}
