import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb/connection';
import Trip from '@/lib/mongodb/models/Trip';
import User from '@/lib/mongodb/models/User';
import TripFile from '@/lib/mongodb/models/TripFile';
import { downloadFile } from '@/lib/utils/storage';
import { barcodeFields, SCANNABLE_MIME } from '@/lib/passes/files';

// A trip's worth of screenshots per call, at a few hundred ms each.
const BATCH = 20;

// ─── POST /api/trips/[id]/passes ──────────────────────────────────────────────
// Looks for ticket barcodes in this trip's images that haven't been scanned —
// ones uploaded before scanning existed (new uploads are scanned on the way in).
// Each file is scanned once, barcode or not.
export async function POST(
  _req: Request,
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

  const pending = await TripFile.find({
    tripId: id, resourceType: 'file',
    mimeType: { $in: [...SCANNABLE_MIME] },
    gcsPath: { $exists: true },
    barcodeScannedAt: { $exists: false },
  }, 'gcsPath type linkedTo').limit(BATCH).lean() as any[];

  let found = 0;
  for (const f of pending) {
    try {
      const fields = await barcodeFields(new Uint8Array(await downloadFile(f.gcsPath)), f, id);
      await TripFile.updateOne({ _id: f._id, barcodeScannedAt: { $exists: false } }, { $set: fields });
      if (fields.barcode) found++;
    } catch { /* couldn't download it — tried again next time */ }
  }

  return NextResponse.json({ scanned: pending.length, found });
}
