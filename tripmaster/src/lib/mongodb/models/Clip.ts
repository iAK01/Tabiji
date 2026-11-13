import mongoose, { Schema } from 'mongoose';

// One clip sent from the Safari clipper: the page, what was highlighted, the
// traveller's choices, and what it became (SavedPlace ids).

const ClipSchema = new Schema({
  userId:         { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  url:            String,
  title:          String,
  selection:      String,
  note:           String,
  hadScreenshot:  Boolean,
  tripChoice:     { type: Schema.Types.ObjectId, ref: 'Trip' },   // unset: worked out
  categoryChoice: String,                                         // unset: worked out
  status:         { type: String, enum: ['processing', 'done', 'failed'], default: 'processing' },
  error:          String,
  summary:        String,
  savedIds:       [{ type: Schema.Types.ObjectId, ref: 'SavedPlace' }],
}, { timestamps: true });

ClipSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.models.Clip || mongoose.model('Clip', ClipSchema);
