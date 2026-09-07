import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { Readable } from 'node:stream';
import { ZipArchive } from 'archiver';
import connectDB from '@/lib/mongodb/connection';
import Trip from '@/lib/mongodb/models/Trip';
import User from '@/lib/mongodb/models/User';
import TripExpense from '@/lib/mongodb/models/TripExpense';
import { getFileStream } from '@/lib/utils/storage';

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
  'image/heic': 'heic', 'image/heif': 'heif', 'application/pdf': 'pdf',
};

// ─── GET /api/trips/[id]/expenses/export?payer=X ───────────────────────────────
// Streams every captured receipt (optionally filtered to one payer) into a single
// zip, filenames formatted so they're self-describing once dropped into whatever
// invoicing system the user already uses — no in-app invoicing being built here.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const trip = await Trip.findOne({ _id: id, userId: user._id, deleted: false });
  if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const payer = searchParams.get('payer');

  const query: Record<string, any> = { tripId: id, receiptGcsPath: { $exists: true, $ne: null } };
  if (payer) query.payer = payer;

  const expenses = await TripExpense.find(query).sort({ date: 1 });
  if (expenses.length === 0) {
    return NextResponse.json({ error: 'No receipts to export' }, { status: 404 });
  }

  const archive = new ZipArchive({ zlib: { level: 9 } });
  const usedNames = new Set<string>();

  for (const e of expenses) {
    const dateStr  = e.date ? new Date(e.date).toISOString().split('T')[0] : 'undated';
    const category = (e.category ?? 'other').replace(/[^a-zA-Z0-9]/g, '');
    const amount   = typeof e.amount === 'number' ? e.amount.toFixed(2) : '0.00';
    const ext      = EXT_BY_MIME[e.receiptMimeType ?? ''] ?? 'jpg';
    let filename   = `${dateStr}_${category}_${amount}${e.currency ?? 'EUR'}.${ext}`;
    // Guard against duplicate filenames (same date/category/amount twice)
    if (usedNames.has(filename)) {
      filename = `${dateStr}_${category}_${amount}${e.currency ?? 'EUR'}_${e._id}.${ext}`;
    }
    usedNames.add(filename);

    try {
      archive.append(getFileStream(e.receiptGcsPath), { name: filename });
    } catch {
      // Skip a receipt that's gone missing in storage rather than failing the whole export.
    }
  }

  archive.finalize();

  const webStream = Readable.toWeb(archive as unknown as Readable) as ReadableStream;
  const zipName = `receipts${payer ? `-${payer}` : ''}.zip`;

  return new NextResponse(webStream, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${zipName}"`,
    },
  });
}
