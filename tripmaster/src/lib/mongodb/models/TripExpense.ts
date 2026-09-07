import mongoose, { Schema } from 'mongoose';

// One document per expense — same convention as TripFile, not TripLogistics's single
// array-in-one-doc pattern. Expenses are created incrementally over the course of a
// trip, often from mobile with poor connectivity, so independent documents avoid
// read-modify-write races when several offline-queued captures sync back at once.
const TripExpenseSchema = new Schema({
  tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },

  date:     { type: Date, required: true },
  // Granular — matches the actual Logistics transport/accommodation/venue subtype
  // (train vs taxi vs flight), because the proof documents needed differ between
  // them; a coarse "transport" bucket can't drive that checklist.
  category: {
    type: String,
    enum: [
      'flight', 'train', 'bus', 'ferry', 'car', 'car_hire', 'taxi', 'private_transfer', 'bicycle', 'parking',
      'hotel', 'airbnb', 'hostel', 'camping',
      'concert', 'conference', 'restaurant', 'sports', 'attraction', 'business',
      'meal', 'gratuity', 'other',
    ],
    default: 'other',
  },
  amount:   { type: Number, required: true },
  currency: { type: String, default: 'EUR' },
  // Best-effort converted figure in the trip owner's home currency — not auto-computed
  // server-side yet, just a place to hold it if/when a conversion is supplied.
  homeCurrencyAmount: { type: Number },
  gratuity: { type: Number },
  notes:    { type: String },

  payer: {
    type: String,
    enum: ['personal', 'company', 'promoter', 'client', 'third_party', 'tbc'],
    default: 'tbc',
  },
  status: {
    type: String,
    enum: ['captured', 'confirmed', 'submitted', 'paid'],
    default: 'captured',
  },

  // ── Quick-capture receipt — the single fast mobile photo, same GCS convention
  // as TripFile. Kept separate from the structured proofs[] checklist below, since
  // mobile capture is deliberately "photo first, everything else later" and
  // shouldn't be blocked by a multi-document checklist.
  receiptGcsPath:  { type: String },
  receiptGcsUrl:   { type: String },
  receiptMimeType: { type: String },

  // ── Structured proof checklist — booking confirmation, boarding pass, final
  // invoice, etc. Keyed by the slot key from expenseProofs.ts (e.g.
  // 'boarding_pass'); a slot marked multiple: true (connecting flights) can have
  // more than one entry with the same key.
  proofs: [{
    key:          { type: String, required: true },
    label:        { type: String },
    gcsPath:      { type: String, required: true },
    gcsUrl:       { type: String, required: true },
    mimeType:     { type: String },
    originalName: { type: String },
    uploadedAt:   { type: Date, default: Date.now },
  }],

  // ── Car (personal) only — not proof-checklist shaped. Whether someone claims
  // mileage or fuel receipts depends on the person, not the trip, so this is set
  // per expense rather than assumed.
  reimbursementMethod: { type: String, enum: ['mileage', 'fuel'] },
  mileageDistance:     { type: Number },
  mileageUnit:         { type: String, enum: ['km', 'mi'] },
  mileageRate:         { type: Number },

  // ── Optional link back to the logistics entry this was captured from ───────
  linkedTo: {
    collection: { type: String, enum: ['transport', 'accommodation', 'venue'] },
    entryId:    { type: String },
    label:      { type: String },
  },

}, { timestamps: true });

TripExpenseSchema.index({ tripId: 1, status: 1 });
TripExpenseSchema.index({ tripId: 1, payer: 1 });

export default mongoose.models.TripExpense || mongoose.model('TripExpense', TripExpenseSchema);
