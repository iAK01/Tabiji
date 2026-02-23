import mongoose, { Schema } from 'mongoose';

const TripPackingSchema = new Schema({
  tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true, unique: true },
  items: { type: Schema.Types.Mixed },
  manualAdditions: [{ type: Schema.Types.Mixed }],
  manualRemovals: [{ type: Schema.Types.Mixed }],
  generatedAt: Date,
  generationParams: { type: Schema.Types.Mixed },
  totalItems: Number,
  packedItems: Number,
  packingProgress: Number,
  regenerationHistory: [{ type: Schema.Types.Mixed }],
}, { timestamps: true });

export default mongoose.models.TripPacking || mongoose.model('TripPacking', TripPackingSchema);