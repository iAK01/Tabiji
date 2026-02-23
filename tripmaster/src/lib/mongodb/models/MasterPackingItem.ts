import mongoose, { Schema } from 'mongoose';

const MasterPackingItemSchema = new Schema({
  name: { type: String, required: true, index: true },
  category: { type: String, required: true, index: true },
  essential: { type: Boolean, default: false },
  tripTypes: [{ type: String, enum: ['always', 'work', 'leisure', 'mixed'] }],
  quantityType: { type: String, enum: ['fixed', 'per_night'], default: 'fixed' },
  quantity: { type: Number, default: 1 },
  quantityMin: Number,
  quantityMax: Number,
  preTravelAction: { type: Boolean, default: false },
  preTravelNote: String,
  advisoryNote: String,
  photoUrl: String,
}, { timestamps: true });

export default mongoose.models.MasterPackingItem || mongoose.model('MasterPackingItem', MasterPackingItemSchema);