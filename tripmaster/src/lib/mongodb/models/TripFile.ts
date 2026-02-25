import mongoose, { Schema } from 'mongoose';

const TripFileSchema = new Schema({
  tripId:       { type: Schema.Types.ObjectId, ref: 'Trip', required: true, index: true },
  userId:       { type: Schema.Types.ObjectId, ref: 'User', required: true },

  resourceType: { type: String, enum: ['file', 'link'], default: 'file' },

  name:         { type: String, required: true },
  type: {
    type: String,
    enum: [
      'boarding_pass',
      'train_ticket',
      'hotel_confirmation',
      'car_hire',
      'event_brief',
      'primary',
      'hotel',
      'event_website',
      'artist_lineup',
      'venue',
      'booking_reference',
      'visa',
      'insurance',
      'passport',
      'useful_info',
      'other',
    ],
    default: 'other',
  },

  // File-only
  gcsPath:  { type: String },
  gcsUrl:   { type: String },
  mimeType: { type: String },
  size:     { type: Number },

  // Link-only
  linkUrl:  { type: String },

  linkedTo: {
    collection: { type: String, enum: ['transport', 'accommodation', 'itinerary_stop'] },
    entryId:    { type: String },
    label:      { type: String },
  },

  notes: { type: String },

}, { timestamps: true });

TripFileSchema.index({ tripId: 1, type: 1 });

export default mongoose.models.TripFile || mongoose.model('TripFile', TripFileSchema);