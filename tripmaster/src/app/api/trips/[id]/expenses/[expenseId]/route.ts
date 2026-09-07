import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb/connection';
import User from '@/lib/mongodb/models/User';
import TripExpense from '@/lib/mongodb/models/TripExpense';
import { uploadFile, deleteFile } from '@/lib/utils/storage';

const RECEIPT_MIME = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
// Images are compressed client-side before they ever reach here (typically well
// under 1-2MB), so this ceiling mainly exists as a generous safety net for
// legitimately large PDFs and the rare case client-side compression couldn't
// run (e.g. a HEIC file a non-WebKit browser can't decode, falling back to the
// original) — better to accept a large file than silently lose the capture.
const MAX_UPLOAD_BYTES = 40 * 1024 * 1024;

// ─── PUT /api/trips/[id]/expenses/[expenseId] ──────────────────────────────────
// Full update — editing a captured expense (fill in payer/status/notes), or
// advancing its status (captured → confirmed → submitted → paid). multipart/
// form-data, same fields as POST; a new receipt replaces the old one.
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; expenseId: string }> }
) {
  const { id, expenseId } = await params;
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const doc = await TripExpense.findOne({ _id: expenseId, tripId: id, userId: user._id });
  if (!doc) return NextResponse.json({ error: 'Expense not found' }, { status: 404 });

  const fd = await req.formData();
  const updates: Record<string, any> = {};

  const dateRaw = fd.get('date') as string | null;
  if (dateRaw) updates.date = new Date(dateRaw);

  const amountRaw = fd.get('amount') as string | null;
  if (amountRaw !== null) {
    const amount = parseFloat(amountRaw);
    if (!isNaN(amount)) updates.amount = amount;
  }

  const category = fd.get('category') as string | null;
  if (category !== null) updates.category = category;
  const currency = fd.get('currency') as string | null;
  if (currency !== null) updates.currency = currency;
  const payer = fd.get('payer') as string | null;
  if (payer !== null) updates.payer = payer;
  const status = fd.get('status') as string | null;
  if (status !== null) updates.status = status;
  const notes = fd.get('notes') as string | null;
  if (notes !== null) updates.notes = notes;

  const homeCurrencyAmount = fd.get('homeCurrencyAmount') as string | null;
  if (homeCurrencyAmount !== null) updates.homeCurrencyAmount = homeCurrencyAmount ? parseFloat(homeCurrencyAmount) : null;
  const gratuity = fd.get('gratuity') as string | null;
  if (gratuity !== null) updates.gratuity = gratuity ? parseFloat(gratuity) : null;

  const linkedToRaw = fd.get('linkedTo') as string | null;
  if (linkedToRaw !== null) {
    if (linkedToRaw) {
      try { updates.linkedTo = JSON.parse(linkedToRaw); } catch { /* ignore */ }
    } else {
      updates.linkedTo = null;
    }
  }

  const receipt = fd.get('receipt') as File | null;
  if (receipt && receipt.size) {
    if (!RECEIPT_MIME.has(receipt.type)) {
      return NextResponse.json({ error: 'Only PDF and image receipts are accepted' }, { status: 400 });
    }
    if (receipt.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: `Receipt exceeds the ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB limit` }, { status: 400 });
    }
    if (doc.receiptGcsPath) await deleteFile(doc.receiptGcsPath);
    const safeName = receipt.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const gcsPath  = `${user._id}/${id}/expenses/${Date.now()}-${safeName}`;
    const buffer   = Buffer.from(await receipt.arrayBuffer());
    const gcsUrl   = await uploadFile(buffer, gcsPath, receipt.type);
    updates.receiptGcsPath  = gcsPath;
    updates.receiptGcsUrl   = gcsUrl;
    updates.receiptMimeType = receipt.type;
  }

  // ── Car (personal) reimbursement method ───────────────────────────────────
  const reimbursementMethod = fd.get('reimbursementMethod') as string | null;
  if (reimbursementMethod !== null) updates.reimbursementMethod = reimbursementMethod || null;
  const mileageDistance = fd.get('mileageDistance') as string | null;
  if (mileageDistance !== null) updates.mileageDistance = mileageDistance ? parseFloat(mileageDistance) : null;
  const mileageUnit = fd.get('mileageUnit') as string | null;
  if (mileageUnit !== null) updates.mileageUnit = mileageUnit || null;
  const mileageRate = fd.get('mileageRate') as string | null;
  if (mileageRate !== null) updates.mileageRate = mileageRate ? parseFloat(mileageRate) : null;

  // ── Structured proof checklist ─────────────────────────────────────────────
  // Explicit removals first (by gcsPath), then new uploads — any 'proof_<key>'
  // field replaces whatever was previously stored under that key (a slot marked
  // "multiple" sends every file it wants to keep for that key in this request).
  let proofs = [...(doc.proofs ?? [])];

  const removedProofPathsRaw = fd.get('removedProofPaths') as string | null;
  if (removedProofPathsRaw) {
    try {
      const removedPaths: string[] = JSON.parse(removedProofPathsRaw);
      for (const path of removedPaths) await deleteFile(path);
      proofs = proofs.filter((p: any) => !removedPaths.includes(p.gcsPath));
      // The single quick-capture receipt lives in its own top-level fields, not the
      // proofs[] array — clear those too if its path was among the ones removed,
      // otherwise the document fields keep pointing at a file that no longer exists.
      if (doc.receiptGcsPath && removedPaths.includes(doc.receiptGcsPath)) {
        updates.receiptGcsPath = null;
        updates.receiptGcsUrl = null;
        updates.receiptMimeType = null;
      }
    } catch { /* ignore */ }
  }

  // Validate every incoming proof file *before* uploading anything — a file
  // that silently fails validation partway through would look like a success
  // to the user (200 response) while quietly vanishing. Reject the whole
  // request loudly instead, so they know to retry rather than trust a gap.
  const incomingProofFields = Array.from(fd.entries())
    .filter((entry): entry is [string, File] => entry[0].startsWith('proof_') && entry[1] instanceof File && !!entry[1].size);

  for (const [, value] of incomingProofFields) {
    if (!RECEIPT_MIME.has(value.type)) {
      return NextResponse.json({ error: `${value.name}: only PDF and image files are accepted` }, { status: 400 });
    }
    if (value.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: `${value.name} exceeds the ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB limit` }, { status: 400 });
    }
  }

  const newProofsByKey = new Map<string, any[]>();
  for (const [fieldName, value] of incomingProofFields) {
    const key      = fieldName.slice('proof_'.length);
    const safeName = value.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const gcsPath  = `${user._id}/${id}/expenses/${expenseId}/${key}-${Date.now()}-${safeName}`;
    const buffer   = Buffer.from(await value.arrayBuffer());
    const gcsUrl   = await uploadFile(buffer, gcsPath, value.type);
    const entry = { key, gcsPath, gcsUrl, mimeType: value.type, originalName: value.name, uploadedAt: new Date() };
    const arr = newProofsByKey.get(key) ?? [];
    arr.push(entry);
    newProofsByKey.set(key, arr);
  }
  if (newProofsByKey.size > 0) {
    for (const [key, entries] of newProofsByKey) {
      const stale = proofs.filter((p: any) => p.key === key);
      for (const s of stale) await deleteFile(s.gcsPath);
      proofs = proofs.filter((p: any) => p.key !== key);
      proofs.push(...entries);
    }
  }
  if (removedProofPathsRaw || newProofsByKey.size > 0) updates.proofs = proofs;

  const expense = await TripExpense.findByIdAndUpdate(expenseId, updates, { new: true });
  return NextResponse.json({ expense });
}

// ─── DELETE /api/trips/[id]/expenses/[expenseId] ───────────────────────────────
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; expenseId: string }> }
) {
  const { id, expenseId } = await params;
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const doc = await TripExpense.findOne({ _id: expenseId, tripId: id, userId: user._id });
  if (!doc) return NextResponse.json({ error: 'Expense not found' }, { status: 404 });

  if (doc.receiptGcsPath) await deleteFile(doc.receiptGcsPath);
  for (const p of (doc.proofs ?? [])) await deleteFile(p.gcsPath);
  await TripExpense.findByIdAndDelete(expenseId);
  return NextResponse.json({ success: true });
}
