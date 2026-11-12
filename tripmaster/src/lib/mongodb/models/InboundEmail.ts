import mongoose, { Schema } from 'mongoose';

// One forwarded email (received through Resend) and what the app did with it.
//
// `resendId` is unique, so a webhook delivered twice is handled once.
// `files` are the attachments kept from it, already stored; trip resources are
// made from them per item, so one ticket PDF can sit on the stop it's for.
// `items` are what the email was read as — see lib/inbound/types.ts — each
// recording exactly what it added or changed, which is what Undo reverses.

const InboundEmailSchema = new Schema({
  resendId:   { type: String, required: true, unique: true },
  userId:     { type: Schema.Types.ObjectId, ref: 'User', index: true },
  from:       String,
  subject:    String,
  receivedAt: Date,
  status:     { type: String, enum: ['processing', 'done', 'failed', 'rejected'], default: 'processing' },
  error:      String,
  summary:    String,
  tripId:     { type: Schema.Types.ObjectId, ref: 'Trip' },   // where most of it went
  files:      { type: [Schema.Types.Mixed], default: [] },
  items:      { type: [Schema.Types.Mixed], default: [] },
}, { timestamps: true });

InboundEmailSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.models.InboundEmail || mongoose.model('InboundEmail', InboundEmailSchema);
