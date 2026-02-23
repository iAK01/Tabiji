import mongoose, { Schema } from 'mongoose';

const TripIntelligenceSchema = new Schema({
  tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true, unique: true },
  electrical: { type: Schema.Types.Mixed },
  currency: { type: Schema.Types.Mixed },
  language: { type: Schema.Types.Mixed },
  timezone: { type: Schema.Types.Mixed },
  weather: { type: Schema.Types.Mixed },
  personalization: { type: Schema.Types.Mixed },
  calculatedAt: Date,
  lastUpdated: Date,
}, { timestamps: true });

export default mongoose.models.TripIntelligence || mongoose.model('TripIntelligence', TripIntelligenceSchema);