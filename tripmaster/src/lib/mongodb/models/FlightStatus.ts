import mongoose, { Schema } from 'mongoose';

// Live status for one flight on one day ("FR94|2026-10-19"), shared by every
// trip on it. lib/flights/live.ts decides when to ask again.
const FlightStatusSchema = new Schema({
  key:       { type: String, required: true, unique: true },
  status:    { type: Schema.Types.Mixed, default: null },  // lib/flights/status FlightStatus
  notFound:  { type: Boolean, default: false },            // the provider has no such flight that day
  attemptAt: { type: Date, default: null },                // last lookup started — claims it against overlapping runs
  slots:     { type: Schema.Types.Mixed, default: {} },    // one-off checks done: { day: ISO, before: ISO }
  lastError: { type: String, default: null },
  unitsLeft: { type: Number, default: null },              // only on the '__units' row: provider allowance left this month
}, { timestamps: true });

export default mongoose.models.FlightStatus || mongoose.model('FlightStatus', FlightStatusSchema);
