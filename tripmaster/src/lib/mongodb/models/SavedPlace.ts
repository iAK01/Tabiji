import mongoose, { Schema } from 'mongoose';
import { CLIP_CATEGORIES } from '@/lib/clip/categories';

// A place or tip the traveller saved from the web (the Safari clipper), shown in
// Discover under "Saved by you". With a trip, it's for that trip; without one,
// it's for the city — any trip there shows it.

const SavedPlaceSchema = new Schema({
  userId:      { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tripId:      { type: Schema.Types.ObjectId, ref: 'Trip', index: true },
  city:        String,
  country:     String,
  kind:        { type: String, enum: ['place', 'tip'], required: true },
  category:    { type: String, enum: CLIP_CATEGORIES, default: 'activity' },
  name:        { type: String, required: true },
  summary:     String,
  tip:         String,
  address:     String,
  coordinates: { lat: Number, lng: Number },
  website:     String,
  pinTriedAt:  Date,      // last time a map pin was looked for — unpinned places are tried again a day later
  // Every page it was saved from — saving the same place twice adds a source, not a duplicate
  sources:     [{ _id: false, url: String, title: String, site: String, clipId: Schema.Types.ObjectId, at: Date }],
}, { timestamps: true });

SavedPlaceSchema.index({ userId: 1, city: 1 });

export default mongoose.models.SavedPlace || mongoose.model('SavedPlace', SavedPlaceSchema);
