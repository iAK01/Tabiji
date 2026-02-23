import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { uploadFile } from '@/lib/utils/storage';

export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file') as File;
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.name.split('.').pop();
  const destination = `tripmaster/packing-items/${Date.now()}.${ext}`;
  const url = await uploadFile(buffer, destination, file.type);

  return NextResponse.json({ url });
}