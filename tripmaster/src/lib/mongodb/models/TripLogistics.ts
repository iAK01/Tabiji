import mongoose, { Schema } from 'mongoose';

const TripLogisticsSchema = new Schema({
  tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true, unique: true },
  transportation: [{ type: Schema.Types.Mixed }],
  accommodation: [{ type: Schema.Types.Mixed }],
  venues: [{ type: Schema.Types.Mixed }],          // ← add this
  documents: { type: Schema.Types.Mixed },
  predepartureChecklist: [{ type: Schema.Types.Mixed }],
  airportLogistics: { type: Schema.Types.Mixed },
}, { timestamps: true });

export default mongoose.models.TripLogistics || mongoose.model('TripLogistics', TripLogisticsSchema);