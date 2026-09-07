import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb/connection';
import Trip from '@/lib/mongodb/models/Trip';
import User from '@/lib/mongodb/models/User';
import TripExpense from '@/lib/mongodb/models/TripExpense';
import { uploadFile } from '@/lib/utils/storage';

const RECEIPT_MIME = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
// Images are compressed client-side before they ever reach here, so this ceiling
// is mainly a generous safety net for large PDFs and rare compression-fallback
// cases — better to accept a large file than silently lose the capture.
const MAX_UPLOAD_BYTES = 40 * 1024 * 1024;

// ─── GET /api/trips/[id]/expenses ──────────────────────────────────────────────
export async function GET(
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

  const expenses = await TripExpense.find({ tripId: id }).sort({ date: -1, createdAt: -1 });
  return NextResponse.json({ expenses });
}

// ─── POST /api/trips/[id]/expenses ─────────────────────────────────────────────
// multipart/form-data: date, category, amount, currency, gratuity, notes, payer,
// status, linkedTo (JSON string, optional), receipt (file, optional). Receipt is
// optional because a booking-flow-created expense (from the "reimbursable?" prompt
// on a logistics form) has nothing to photograph — it already has the cost.
export async function POST(
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

  const fd = await req.formData();

  const dateRaw = fd.get('date') as string | null;
  const date    = dateRaw ? new Date(dateRaw) : new Date();
  const amount  = parseFloat((fd.get('amount') as string) ?? '');
  if (isNaN(amount)) return NextResponse.json({ error: 'amount is required' }, { status: 400 });

  const doc: Record<string, any> = {
    tripId: id, userId: user._id,
    date,
    amount,
    category: (fd.get('category') as string) || 'other',
    currency: (fd.get('currency') as string) || 'EUR',
    payer:    (fd.get('payer') as string) || 'tbc',
    status:   (fd.get('status') as string) || 'captured',
  };

  const homeCurrencyAmount = fd.get('homeCurrencyAmount') as string | null;
  if (homeCurrencyAmount) doc.homeCurrencyAmount = parseFloat(homeCurrencyAmount);
  const gratuity = fd.get('gratuity') as string | null;
  if (gratuity) doc.gratuity = parseFloat(gratuity);
  const notes = fd.get('notes') as string | null;
  if (notes) doc.notes = notes;

  const linkedToRaw = fd.get('linkedTo') as string | null;
  if (linkedToRaw) {
    try { doc.linkedTo = JSON.parse(linkedToRaw); } catch { /* ignore */ }
  }

  const reimbursementMethod = fd.get('reimbursementMethod') as string | null;
  if (reimbursementMethod) doc.reimbursementMethod = reimbursementMethod;
  const mileageDistance = fd.get('mileageDistance') as string | null;
  if (mileageDistance) doc.mileageDistance = parseFloat(mileageDistance);
  const mileageUnit = fd.get('mileageUnit') as string | null;
  if (mileageUnit) doc.mileageUnit = mileageUnit;
  const mileageRate = fd.get('mileageRate') as string | null;
  if (mileageRate) doc.mileageRate = parseFloat(mileageRate);

  const receipt = fd.get('receipt') as File | null;
  if (receipt && receipt.size) {
    if (!RECEIPT_MIME.has(receipt.type)) {
      return NextResponse.json({ error: 'Only PDF and image receipts are accepted' }, { status: 400 });
    }
    if (receipt.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: `Receipt exceeds the ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB limit` }, { status: 400 });
    }
    const safeName = receipt.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const gcsPath  = `${user._id}/${id}/expenses/${Date.now()}-${safeName}`;
    const buffer   = Buffer.from(await receipt.arrayBuffer());
    const gcsUrl   = await uploadFile(buffer, gcsPath, receipt.type);
    doc.receiptGcsPath  = gcsPath;
    doc.receiptGcsUrl   = gcsUrl;
    doc.receiptMimeType = receipt.type;
  }

  const expense = await TripExpense.create(doc);
  return NextResponse.json({ expense }, { status: 201 });
}
